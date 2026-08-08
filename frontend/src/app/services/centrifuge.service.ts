import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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

export interface CentrifugoEvent {
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

export interface LiveLocationPayload {
  latitude: number;
  longitude: number;
  sharer_user_id: string;
  updated_at: string;
}

export interface VoiceRoomPayload {
  original_text: string;
  translated_text: string;
  detected_language: string;
  [key: string]: unknown;
}

/** Type guard for live‑location payloads */
export function isLiveLocationPayload(data: unknown): data is LiveLocationPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    'latitude' in data &&
    'longitude' in data &&
    'sharer_user_id' in data &&
    'updated_at' in data
  );
}

/** Type guard for room‑chat messages */
export function isRoomMessage(data: unknown): data is RoomLiveMessage {
  return typeof data === 'object' && data !== null;
}

/** Type guard for voice‑room payloads (must contain `original_text`) */
export function isVoiceRoomPayload(
  data: unknown,
): data is VoiceRoomPayload {
  return typeof data === 'object' && data !== null && 'original_text' in data;
}

@Injectable({
  providedIn: 'root',
})
export class CentrifugeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isConnected = signal<boolean>(false);
  readonly connectionStatus = signal<string>('disconnected');
  readonly events = signal<CentrifugoEvent[]>([]);

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

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.connectionStatus.set('error: max reconnection attempts reached');
      console.error('Max Centrifugo reconnection attempts reached. Giving up.');
      return;
    }

    const delay = this.calculateBackoffDelay();
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

  async connect(): Promise<void> {
    if (
      this.centrifuge &&
      (this.centrifuge.state === 'connected' || this.centrifuge.state === 'connecting')
    ) {
      return;
    }

    this.connectionStatus.set('connecting');
    try {
      const tokenObj = await firstValueFrom(
        this.http.post<{ token: string }>(
          `${environment.apiUrl}/chat/token`,
          {},
          {
            headers: { Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}` },
          },
        ),
      );

      if (!tokenObj?.token) {
        this.connectionStatus.set('error: rate limited or missing token');
        this.scheduleReconnect();
        return;
      }

      this.centrifuge = new Centrifuge(environment.centrifugoUrl, {
        token: tokenObj.token,
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
      } else {
        console.error('Failed to initialize Centrifugo:', e);
        this.connectionStatus.set('error');
      }
      this.scheduleReconnect();
    }
  }

  subscribe(channel: string, onMessage: (data: unknown) => void): Subscription | null {
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
      this.events.update((prev) => [...prev, { channel, data: ctx.data }]);
      onMessage(ctx.data);
    });
    return sub;
  }

  unsubscribe(channel: string): void {
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
    callback: (data: VoiceRoomPayload) => void,
  ): void {
    this.subscribe(`room_${roomId}`, (data: unknown) => {
      if (isVoiceRoomPayload(data)) {
        callback(data);
      }
    });
  }

  subscribeLiveRoom(
    roomId: string,
    callback: (data: RoomLiveMessage) => void,
  ): void {
    this.subscribe(`room_${roomId}`, (data: unknown) => {
      if (isRoomMessage(data)) {
        callback(data);
      }
    });
  }

  unsubscribeLiveRoom(roomId: string): void {
    this.unsubscribe(`room_${roomId}`);
  }

  subscribeLiveLocation(
    userId: string,
    callback: (data: LiveLocationPayload) => void,
  ): () => void {
    const channel = `location_live_${userId}`;
    this.subscribe(channel, (data: unknown) => {
      if (isLiveLocationPayload(data)) {
        callback(data);
      }
    });
    return () => this.unsubscribe(channel);
  }

  unsubscribeLiveLocation(userId: string): void {
    this.unsubscribe(`location_live_${userId}`);
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
