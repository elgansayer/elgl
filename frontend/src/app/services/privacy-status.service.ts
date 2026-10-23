import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PrivacyStatusControls {
  hideOnlineStatus: boolean;
  hideVipStatus: boolean;
}

type PrivacyStatusProfile = {
  privacy_hide_online_status?: boolean;
  privacy_hide_vip_status?: boolean;
};

@Injectable({ providedIn: 'root' })
export class PrivacyStatusService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  private getHeaders(): { Authorization: string } {
    return {
      Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}`,
    };
  }

  async load(): Promise<PrivacyStatusControls> {
    const profile = await firstValueFrom(
      this.http.get<PrivacyStatusProfile>(`${this.baseUrl}/me`, {
        headers: this.getHeaders(),
      }),
    );

    return {
      hideOnlineStatus: profile.privacy_hide_online_status ?? false,
      hideVipStatus: profile.privacy_hide_vip_status ?? false,
    };
  }

  async setHideOnlineStatus(hidden: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch<PrivacyStatusProfile>(
        `${this.baseUrl}/me`,
        { privacy_hide_online_status: hidden },
        { headers: this.getHeaders() },
      ),
    );
  }

  async setHideVipStatus(hidden: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch<PrivacyStatusProfile>(
        `${this.baseUrl}/me/privacy`,
        { privacy_hide_vip_status: hidden },
        { headers: this.getHeaders() },
      ),
    );
  }
}
