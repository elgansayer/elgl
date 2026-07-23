import { Injectable, inject, signal } from '@angular/core';
import { Centrifuge } from 'centrifuge';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CentrifugoEvent {
  channel: string;
  data: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class CentrifugoService {
  private authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;

  readonly connected = signal(false);
  readonly events = signal<CentrifugoEvent[]>([]);

  private subscriptions = new Map<string, (data: unknown) => void>();

  connect(): void {
    if (this.centrifuge) return;

    const token = this.authService.getAccessToken();
    if (!token) return;

    this.centrifuge = new Centrifuge(environment.centrifugoUrl, {
      token,
    });

    this.centrifuge.on('connect', () => {
      this.connected.set(true);
    });

    this.centrifuge.on('disconnect', () => {
      this.connected.set(false);
    });

    this.centrifuge.connect();
  }

  disconnect(): void {
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.connected.set(false);
    }
  }

  subscribe(channel: string, callback: (data: unknown) => void): void {
    if (!this.centrifuge) return;

    const sub = this.centrifuge.newSubscription(channel);
    sub.on('publication', (ctx) => {
      callback(ctx.data);
      this.events.update((prev) => [...prev, { channel, data: ctx.data }]);
    });
    sub.subscribe();
    this.subscriptions.set(channel, callback);
  }

  unsubscribe(channel: string): void {
    if (!this.centrifuge) return;
    const sub = this.centrifuge.getSubscription(channel);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(channel);
    }
  }

  publish(channel: string, data: unknown): void {
    if (!this.centrifuge) return;
    this.centrifuge.publish(channel, data);
  }
}
