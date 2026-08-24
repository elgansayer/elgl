import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponseBase } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Centrifuge, Subscription } from 'centrifuge';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Maximum number of terminal/initial reconnection attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 8;
/** Base delay in milliseconds for exponential backoff. */
const BASE_RECONNECT_DELAY_MS = 500;
/** Maximum delay cap in milliseconds. */
const MAX_RECONNECT_DELAY_MS = 30_000;

type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'rate-limited'
  | 'error';

interface TokenRequest {
  accessToken: string;
  promise: Promise<string>;
}

@Injectable({
  providedIn: 'root',
})
export class CentrifugeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly subscriptionHandlers = new Map<string, (data: unknown) => void>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyDisconnected = false;
  private connectPromise: Promise<void> | null = null;
  private tokenRequest: TokenRequest | null = null;
  private clientGeneration = 0;
  private hasConnectedOnce = false;

  readonly isConnected = signal<boolean>(false);
  readonly connectionStatus = signal<ConnectionStatus>('disconnected');

  /**
   * Calculates exponential backoff delay with jitter.
   * Uses the formula: min(cap, base * 2^attempt) with +/-25% jitter.
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
  private getRetryAfterMs(response: HttpResponseBase, fallbackMs: number): number {
    const raw = response.headers.get('Retry-After');
    if (!raw) return fallbackMs;
    const seconds = Number.parseInt(raw, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RECONNECT_DELAY_MS);
    }
    return fallbackMs;
  }

  private scheduleReconnect(overrideDelayMs?: number): void {
    if (this.intentionallyDisconnected || this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.connectionStatus.set('error');
      console.error('Max Centrifugo reconnection attempts reached. Giving up.');
      return;
    }

    const delay = overrideDelayMs ?? this.calculateBackoffDelay();
    this.reconnectAttempts += 1;

    // Exception allowed by frontend/AGENTS.md's Lifecycle Hook Bans note:
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
    if (!this.authService.getAccessToken()) {
      if (this.centrifuge || this.connectPromise) {
        this.disconnect();
      } else {
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
      }
      return;
    }

    if (
      this.centrifuge &&
      (this.centrifuge.state === 'connected' || this.centrifuge.state === 'connecting')
    ) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.intentionallyDisconnected = false;
    this.connectionStatus.set(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
    const generation = ++this.clientGeneration;

    const promise = this.initialiseClient(generation);
    this.connectPromise = promise;
    try {
      await promise;
    } finally {
      if (this.connectPromise === promise) {
        this.connectPromise = null;
      }
    }
  }

  private async initialiseClient(generation: number): Promise<void> {
    try {
      const token = await this.fetchConnectionToken();
      if (this.intentionallyDisconnected || generation !== this.clientGeneration) {
        return;
      }

      const previousClient = this.centrifuge;
      const client = this.createClient(token);
      this.centrifuge = client;

      client.on('connecting', () => {
        if (this.centrifuge !== client) return;
        this.isConnected.set(false);
        this.connectionStatus.set(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
      });

      client.on('connected', () => {
        if (this.centrifuge !== client) return;
        this.reconnectAttempts = 0;
        this.hasConnectedOnce = true;
        this.isConnected.set(true);
        this.connectionStatus.set('connected');
      });

      client.on('disconnected', () => {
        if (this.centrifuge !== client) return;
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');

        // Centrifuge handles transient reconnects internally. A `disconnected`
        // event is terminal, so create a fresh client only for that state.
        if (!this.intentionallyDisconnected) {
          this.scheduleReconnect();
        }
      });

      client.on('error', () => {
        if (this.centrifuge !== client) return;
        console.error('Centrifugo connection error.');
        this.isConnected.set(false);
        this.connectionStatus.set(client.state === 'connecting' ? 'reconnecting' : 'error');
      });

      this.restoreSubscriptions();
      previousClient?.disconnect();
      client.connect();
    } catch (error) {
      if (this.intentionallyDisconnected || generation !== this.clientGeneration) {
        return;
      }

      this.isConnected.set(false);
      if (error instanceof HttpErrorResponse && error.status === 429) {
        this.connectionStatus.set('rate-limited');
        const retryMs = this.getRetryAfterMs(error, this.calculateBackoffDelay());
        this.scheduleReconnect(retryMs);
      } else {
        console.error('Failed to initialise Centrifugo connection.');
        this.connectionStatus.set('error');
        this.scheduleReconnect();
      }
    }
  }

  subscribe(channel: string, onMessage: (data: unknown) => void): Subscription | null {
    this.subscriptionHandlers.set(channel, onMessage);

    const existing = this.subscriptions.get(channel);
    if (existing) {
      existing.removeAllListeners('publication');
      existing.on('publication', (ctx) => {
        onMessage(ctx.data);
      });
      return existing;
    }

    return this.createSubscription(channel, onMessage);
  }

  unsubscribe(channel: string): void {
    this.subscriptionHandlers.delete(channel);
    const subscription = this.subscriptions.get(channel);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(channel);
    }
  }

  async publish(channel: string, data: unknown): Promise<void> {
    const subscription = this.subscriptions.get(channel);
    if (subscription) {
      try {
        await subscription.publish(data);
      } catch {
        console.error('Centrifugo subscription publish failed.');
      }
    } else if (this.centrifuge) {
      try {
        await this.centrifuge.publish(channel, data);
      } catch {
        console.error('Centrifugo publish failed.');
      }
    }
  }

  disconnect(): void {
    this.intentionallyDisconnected = true;
    this.clientGeneration += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.hasConnectedOnce = false;

    const client = this.centrifuge;
    this.centrifuge = null;
    this.clearActiveSubscriptions();
    this.subscriptionHandlers.clear();
    client?.disconnect();

    this.isConnected.set(false);
    this.connectionStatus.set('disconnected');
  }
}
