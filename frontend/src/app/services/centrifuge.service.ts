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
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
