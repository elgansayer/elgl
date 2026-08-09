import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugoService } from './centrifugo.service';

export interface CurrentLocation {
  latitude: number;
  longitude: number;
}

export interface LiveLocationData {
  sharer_user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private authService = inject(AuthService);
  private centrifugoService = inject(CentrifugoService);

  private async authHeaders(): Promise<Record<string, string>> {
    const token = this.authService.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async getCurrentLocation(userId: string): Promise<CurrentLocation | null> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${userId}/current`,
      { headers },
    );
    if (!response.ok) return null;
    return response.json();
  }

  async shareCurrentLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${userId}/current`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ latitude, longitude }),
      },
    );
    if (!response.ok) throw new Error('Failed to share location');
  }

  async startLiveShare(
    userId: string,
    viewerUserId: string,
  ): Promise<{ shareId: string; channel: string }> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${userId}/live/start`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ viewerUserId }),
      },
    );
    if (!response.ok) throw new Error('Failed to start live share');
    return response.json();
  }

  async updateLiveLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${userId}/live/update`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ latitude, longitude }),
      },
    );
    if (!response.ok) throw new Error('Failed to update live location');
  }

  async stopLiveShare(userId: string): Promise<void> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${userId}/live`,
      { method: 'DELETE', headers },
    );
    if (!response.ok) throw new Error('Failed to stop live share');
  }

  async getLiveLocation(sharerUserId: string): Promise<LiveLocationData> {
    const headers = await this.authHeaders();
    const response = await fetch(
      `${environment.apiUrl}/location/${sharerUserId}/live`,
      { headers },
    );
    if (!response.ok) throw new Error('No active live share');
    return response.json();
  }

  subscribeToLiveLocation(
    userId: string,
    callback: (data: LiveLocationData) => void,
  ): () => void {
    this.centrifugoService.subscribeLiveLocation(userId, callback);
    return () => this.centrifugoService.unsubscribeLiveLocation(userId);
  }
}
