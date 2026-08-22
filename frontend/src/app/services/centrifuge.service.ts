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

@Injectable({
  providedIn: 'root',
})
export class CentrifugeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();
  /** Primary owner callback retained for backwards-compatible subscribe/unsubscribe. */
  private subscriptionHandlers = new Map<string, (data: unknown) => void>();
  /** Additive feature listeners which must not replace the room owner's callback. */
  private additiveHandlers = new Map<string, Set<(data: unknown) => void>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyDisconnected = false;

  readonly isConnected = signal<boolean>(false);
  readonly connectionStatus = signal<string>('disconnected');

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
    const seconds = parseInt(raw, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_RECONNECT_DELAY_MS);
    }
    return fallbackMs;
  }

  private scheduleReconnect(overrideDelayMs?: number): void {
    if (this.intentionallyDisconnected) {
      return;
    }

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

  private createSubscription(channel: string): Subscription | null {
    if (!this.centrifuge) {
      return null;
    }

    const subscription = this.centrifuge.newSubscription(channel);
    subscription.on('publication', (ctx) => {
      const primary = this.subscriptionHandlers.get(channel);
      primary?.(ctx.data);
      for (const handler of this.additiveHandlers.get(channel) ?? []) {
        handler(ctx.data);
      }
    });
    subscription.subscribe();
    this.subscriptions.set(channel, subscription);
    return subscription;
  }

  private restoreSubscriptions(): void {
    this.clearActiveSubscriptions();
    const channels = new Set([
      ...this.subscriptionHandlers.keys(),
      ...this.additiveHandlers.keys(),
    ]);
    for (const channel of channels) {
      this.createSubscription(channel);
    }
  }

  private cleanupSubscriptionIfUnused(channel: string): void {
    if (this.subscriptionHandlers.has(channel)) return;
    if ((this.additiveHandlers.get(channel)?.size ?? 0) > 0) return;

    this.additiveHandlers.delete(channel);
    const subscription = this.subscriptions.get(channel);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(channel);
    }
  }

  async connect(): Promise<void> {
    if (
      this.centrifuge &&
      (this.centrifuge.state === 'connected' || this.centrifuge.state === 'connecting')
    ) {
      return;
    }

    const accessToken = this.authService.getAccessToken();
    if (!accessToken) {
      this.isConnected.set(false);
      this.connectionStatus.set('disconnected');
      return;
    }

    this.intentionallyDisconnected = false;
    this.connectionStatus.set('connecting');
    try {
      const tokenResponse = await firstValueFrom(
        this.http.post<{ token: string }>(
          `${environment.apiUrl}/chat/token`,
          {},
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            observe: 'response',
          },
        ),
      );

      if (!tokenResponse?.body?.token) {
        this.isConnected.set(false);
        this.connectionStatus.set('error: rate limited or missing token');
        this.scheduleReconnect();
        return;
      }

      const previousClient = this.centrifuge;
      const client = new Centrifuge(environment.centrifugoUrl, {
        token: tokenResponse.body.token,
      });
      this.centrifuge = client;

      client.on('connected', () => {
        if (this.centrifuge !== client) return;
        this.reconnectAttempts = 0;
        this.isConnected.set(true);
        this.connectionStatus.set('connected');
      });

      client.on('disconnected', (ctx) => {
        if (this.centrifuge !== client) return;
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
        if (
          !this.intentionallyDisconnected &&
          (!ctx?.reason || ctx.reason === 'connect error' || ctx.reason === 'disconnect')
        ) {
          this.scheduleReconnect();
        }
      });

      client.on('error', () => {
        if (this.centrifuge !== client) return;
        console.error('Centrifugo connection error.');
        this.connectionStatus.set('error');
      });

      this.restoreSubscriptions();
      previousClient?.disconnect();
      client.connect();
    } catch (error) {
      this.isConnected.set(false);
      if (error instanceof HttpErrorResponse && error.status === 429) {
        this.connectionStatus.set('error: rate limited');
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
      return existing;
    }

    return this.createSubscription(channel);
  }

  /**
   * Adds an independent publication listener without replacing the channel's
   * primary subscriber. The returned cleanup function removes only this listener.
   */
  listen(channel: string, onMessage: (data: unknown) => void): () => void {
    const handlers = this.additiveHandlers.get(channel) ?? new Set<(data: unknown) => void>();
    handlers.add(onMessage);
    this.additiveHandlers.set(channel, handlers);

    if (!this.subscriptions.has(channel)) {
      this.createSubscription(channel);
    }

    return () => {
      const current = this.additiveHandlers.get(channel);
      current?.delete(onMessage);
      if (current?.size === 0) {
        this.additiveHandlers.delete(channel);
      }
      this.cleanupSubscriptionIfUnused(channel);
    };
  }

  unsubscribe(channel: string): void {
    this.subscriptionHandlers.delete(channel);
    this.cleanupSubscriptionIfUnused(channel);
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;

    const client = this.centrifuge;
    this.centrifuge = null;
    this.clearActiveSubscriptions();
    this.subscriptionHandlers.clear();
    this.additiveHandlers.clear();
    client?.disconnect();

    this.isConnected.set(false);
    this.connectionStatus.set('disconnected');
  }
}
