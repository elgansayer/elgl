import { Injectable, inject, signal } from '@angular/core';
import { Centrifuge } from 'centrifuge';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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

    this.centrifuge.on('connected', () => {
      this.connected.set(true);
    });

    this.centrifuge.on('disconnected', () => {
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
}
