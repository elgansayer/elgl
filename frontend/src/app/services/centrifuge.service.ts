import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Centrifuge, Subscription } from 'centrifuge';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CentrifugeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private centrifuge: Centrifuge | null = null;
  private subscriptions = new Map<string, Subscription>();

  readonly isConnected = signal<boolean>(false);
  readonly connectionStatus = signal<string>('disconnected');

  async connect(): Promise<void> {
    if (this.centrifuge && (this.centrifuge.state === 'connected' || this.centrifuge.state === 'connecting')) {
      return;
    }

    this.connectionStatus.set('connecting');
    try {
      const tokenObj = await firstValueFrom(
        this.http.post<{ token: string }>(`${environment.apiUrl}/chat/token`, {}, {
          headers: { Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}` }
        })
      );

      if (!tokenObj?.token) {
        this.connectionStatus.set('error: missing token');
        return;
      }

      this.centrifuge = new Centrifuge(environment.centrifugoUrl, {
        token: tokenObj.token
      });

      this.centrifuge.on('connected', () => {
        this.isConnected.set(true);
        this.connectionStatus.set('connected');
      });

      this.centrifuge.on('disconnected', () => {
        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
      });

      this.centrifuge.on('error', (ctx) => {
        console.error('Centrifugo error:', ctx);
        this.connectionStatus.set('error');
      });

      this.centrifuge.connect();
    } catch (e) {
      console.error('Failed to initialize Centrifugo:', e);
      this.connectionStatus.set('error');
    }
  }

  subscribe(channel: string, onMessage: (data: any) => void): Subscription | null {
    if (!this.centrifuge) return null;
    let sub = this.subscriptions.get(channel);
    if (!sub) {
      sub = this.centrifuge.newSubscription(channel);
      this.subscriptions.set(channel, sub);
      sub.subscribe();
    }
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

  disconnect(): void {
    if (this.centrifuge) {
      this.centrifuge.disconnect();
      this.centrifuge = null;
      this.isConnected.set(false);
      this.connectionStatus.set('disconnected');
    }
  }
}
