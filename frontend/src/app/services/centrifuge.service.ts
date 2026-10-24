import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponseBase } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Centrifuge, Subscription } from 'centrifuge';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Maximum number of reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 8;
/** Base delay in milliseconds for exponential backoff */
const BASE_RECONNECT_DELAY_MS = 500;
/** Maximum delay cap in milliseconds */
const MAX_RECONNECT_DELAY_MS = 30_000;

type ConnectionStatus =
  'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'rate-limited' | 'error';


interface TokenRequest {
  accessToken: string;
  promise: Promise<string>;
}

export interface CentrifugeEvent {
  channel: string;
  data: unknown;
}

export interface RoomLiveMessage {
  type?: string;
  content?: string;
  sender_id?: string;
  id?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class CentrifugeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();
  private readonly subscriptionHandlers = new Map<string, (data: unknown) => void>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenRequest: TokenRequest | null = null;

  readonly events = signal<CentrifugeEvent[]>([]);
  readonly isConnected = signal<boolean>(false);
  readonly connectionStatus = signal<string>('disconnected');

  /**
   * Calculates exponential backoff delay with jitter.
   * Uses the formula: min(cap, base * 2^attempt) with ±25% jitter.
   */
  private calculateBackoffDelay(): number {
    const exponentialDelay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
    );
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(exponentialDelay + jitter));
  }

  /**
   * Reads the `Retry-After` header from an HTTP response, falling back to our
   * exponential backoff when the header is absent or unparseable.
   */
  private getRetryAfterMs(
    response: HttpResponseBase,
    fallbackMs: number,
  ): number {
    const raw = response.headers.get('Retry-After');
    if (!raw) return fallbackMs;
    const seconds = parseInt(raw, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RECONNECT_DELAY_MS);
    }
    return fallbackMs;
  }

  private scheduleReconnect(
    overrideDelayMs?: number,
  ): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.connectionStatus.set('error: max reconnection attempts reached');
      console.error('Max Centrifugo reconnection attempts reached. Giving up.');
      return;
    }

    const delay = overrideDelayMs ?? this.calculateBackoffDelay();
    this.reconnectAttempts += 1;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exception allowed by AGENTS.md Section 5.3:
    // `setTimeout` is permitted for imperative third-party library integration
    // (Centrifugo reconnection backoff is a non-reactive real-time concern).
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private clearActiveSubscriptions(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();
  }

  private createSubscription(
    channel: string,
    onMessage: (data: unknown) => void,
  ): Subscription | null {
    if (!this.centrifuge) {
      return null;
    }

    const subscription = this.centrifuge.newSubscription(channel);
    subscription.on('publication', (ctx) => {
      onMessage(ctx.data);
      this.events.update((prev) => [...prev, { channel, data: ctx.data }]);
    });
    subscription.subscribe();
    this.subscriptions.set(channel, subscription);
    return subscription;
  }

  private restoreSubscriptions(): void {
    this.clearActiveSubscriptions();
    for (const [channel, onMessage] of this.subscriptionHandlers.entries()) {
      this.createSubscription(channel, onMessage);
    }
  }

  /**
   * Mint a short-lived connection token using the current Supabase access token.
   * Requests for the same access token are deduplicated, but an account/session
   * change always starts a new request so a stale credential cannot cross users.
   */
  private async fetchConnectionToken(): Promise<string> {
    const accessToken = this.authService.getAccessToken();
    if (!accessToken) {
      throw new Error('Centrifugo authentication is unavailable.');
    }

    if (this.tokenRequest?.accessToken === accessToken) {
      return this.tokenRequest.promise;
    }

    const promise = firstValueFrom(
      this.http.post<{ token: string }>(
        `${environment.apiUrl}/chat/token`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          observe: 'response',
        },
      ),
    ).then((response) => {
      const token = response?.body?.token?.trim();
      if (!token) {
        throw new Error('Centrifugo token endpoint returned no token.');
      }
      return token;
    });

    const request: TokenRequest = { accessToken, promise };
    this.tokenRequest = request;

    try {
      return await promise;
    } finally {
      if (this.tokenRequest === request) {
        this.tokenRequest = null;
      }
    }
  }

  /**
   * Keep client construction isolated so the transport lifecycle can be tested
   * independently from the third-party WebSocket implementation.
   */
  private createClient(initialToken: string): Centrifuge {
    return new Centrifuge(environment.centrifugoUrl, {
      token: initialToken,
      // Centrifugo calls this whenever the short-lived connection token needs
      // refreshing, including after long-lived tabs reconnect.
      getToken: () => this.fetchConnectionToken(),
    });
  }

  async connect(): Promise<void> {
    if (
      this.centrifuge &&
      (this.centrifuge.state === 'connected' || this.centrifuge.state === 'connecting')
    ) {
      return;
    }

    this.connectionStatus.set('connecting');
    try {
      const tokenResponse = await firstValueFrom(
        this.http.post<{ token: string }>(
          `${environment.apiUrl}/chat/token`,
          {},
          {
            headers: { Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}` },
            observe: 'response',
          },
        ),
      );

      if (!tokenResponse?.body?.token) {
        this.connectionStatus.set('error: rate limited or missing token');
        this.scheduleReconnect();
        return;
      }

      this.centrifuge = new Centrifuge(environment.centrifugoUrl, {
        token: tokenResponse.body.token,
      });

      this.centrifuge.on('connected', () => {
        this.reconnectAttempts = 0;
        this.isConnected.set(true);
        this.connectionStatus.set('connected');
      });

      this.centrifuge.on('disconnected', (ctx) => {
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
        // Automatically reconnect on unexpected disconnects
        if (!ctx?.reason || ctx.reason === 'connect error' || ctx.reason === 'disconnect') {
          this.scheduleReconnect();
        }
      });

      this.centrifuge.on('error', (ctx) => {
        console.error('Centrifugo error:', ctx);
        this.connectionStatus.set('error');
      });

      this.centrifuge.connect();
    } catch (e) {
      // Check for 429 Too Many Requests from rate-limited token endpoint
      if (e instanceof HttpErrorResponse && e.status === 429) {
        this.connectionStatus.set('error: rate limited');
        // Use the Retry-After header provided by the backend
        const retryMs = this.getRetryAfterMs(e, this.calculateBackoffDelay());
        this.scheduleReconnect(retryMs);
      } else {
        console.error('Failed to initialize Centrifugo:', e);
        this.connectionStatus.set('error');
        this.scheduleReconnect();
      }
    }
  }

  subscribe(channel: string, onMessage: (data: unknown) => void): Subscription | null {
    this.subscriptionHandlers.set(channel, onMessage);
    if (!this.centrifuge) return null;
    let sub = this.subscriptions.get(channel);
    if (!sub) {
      sub = this.centrifuge.newSubscription(channel);
      this.subscriptions.set(channel, sub);
      sub.subscribe();
    }
    // Reusing an existing subscription would otherwise stack another
    // 'publication' listener on top of any previous one, leaking closures
    // and delivering each message to every stale handler.
    sub.removeAllListeners('publication');
    sub.on('publication', (ctx) => {
      onMessage(ctx.data);
    });
    return sub;
  }

  listen(channel: string, onMessage: (data: unknown) => void): () => void {
    this.subscribe(channel, onMessage);
    return () => {
      this.unsubscribe(channel);
    };
  }

  unsubscribe(channel: string): void {
    this.subscriptionHandlers.delete(channel);
    const sub = this.subscriptions.get(channel);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(channel);
    }
  }

  async publish(channel: string, data: unknown): Promise<void> {
    const sub = this.subscriptions.get(channel);
    if (sub) {
      try {
        await sub.publish(data);
      } catch (e) {
        console.error('Centrifuge subscription publish error:', e);
      }
    } else if (this.centrifuge) {
      try {
        // The Centrifuge client has a native publish method on the instance.
        await this.centrifuge.publish(channel, data);
      } catch (e) {
        console.error('Centrifuge publish error:', e);
      }
    }
  }


  /**
   * Subscribes to a voice‑room channel and calls `callback` for every
   * translated message. The handler receives the full payload, which now
   * includes `original_text`, `translated_text`, and `detected_language`.
   */
  subscribeVoiceRoom(
    roomId: string,
    callback: (
      data: {
        original_text: string;
        translated_text: string;
        detected_language: string;
      } & Record<string, unknown>,
    ) => void,
  ): void {
    this.subscribe(`room_${roomId}`, (data: unknown) => {
      if (this.isVoiceRoomPayload(data)) {
        callback(data);
      }
    });
  }

  subscribeLiveRoom(
    roomId: string,
    callback: (data: RoomLiveMessage) => void,
  ): void {
    this.subscribe(`room_${roomId}`, (data: unknown) => {
      if (this.isRoomMessage(data)) {
        callback(data);
      }
    });
  }

  unsubscribeLiveRoom(roomId: string): void {
    this.unsubscribe(`room_${roomId}`);
  }

  subscribeLiveLocation(
    userId: string,
    callback: (data: {
      latitude: number;
      longitude: number;
      sharer_user_id: string;
      updated_at: string;
    }) => void,
  ): void {
    this.subscribe(`location_live_${userId}`, (data: unknown) => {
      if (this.isLiveLocationPayload(data)) {
        callback(data);
      }
    });
  }

  unsubscribeLiveLocation(userId: string): void {
    this.unsubscribe(`location_live_${userId}`);
  }

  private isLiveLocationPayload(
    data: unknown,
  ): data is {
    latitude: number;
    longitude: number;
    sharer_user_id: string;
    updated_at: string;
  } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'latitude' in data &&
      'longitude' in data &&
      'sharer_user_id' in data &&
      'updated_at' in data
    );
  }

  private isRoomMessage(data: unknown): data is RoomLiveMessage {
    return typeof data === 'object' && data !== null;
  }

  private isVoiceRoomPayload(
    data: unknown,
  ): data is {
    original_text: string;
    translated_text: string;
    detected_language: string;
  } {
    return typeof data === 'object' && data !== null && 'original_text' in data;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.isConnected.set(false);
      this.connectionStatus.set('disconnected');
    }
  }
}
