import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PresencePrivacySettings {
  privacy_hide_online_status: boolean;
  privacy_hide_vip_status: boolean;
}

interface PresencePrivacyProfileResponse {
  privacy_hide_online_status?: boolean;
  privacy_hide_vip_status?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PresencePrivacyService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  async getPresencePrivacy(): Promise<PresencePrivacySettings> {
    const response = await firstValueFrom(
      this.http.get<PresencePrivacyProfileResponse>(`${this.baseUrl}/me`, {
        headers: this.getHeaders(),
      }),
    );

    return {
      privacy_hide_online_status: response.privacy_hide_online_status === true,
      privacy_hide_vip_status: response.privacy_hide_vip_status === true,
    };
  }

  async updatePresencePrivacy(update: Partial<PresencePrivacySettings>): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.baseUrl}/me`, update, {
        headers: this.getHeaders(),
      }),
    );
  }

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    return { Authorization: `Bearer ${token}` };
  }
}
