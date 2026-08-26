import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ProfileVisibility = 'everyone' | 'vips_only' | 'hidden';

interface PrivacySettingsResponse {
  profile_visibility?: ProfileVisibility;
}

export function isProfileVisibility(value: string): value is ProfileVisibility {
  return value === 'everyone' || value === 'vips_only' || value === 'hidden';
}

@Injectable({ providedIn: 'root' })
export class ProfileVisibilityService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  async getProfileVisibility(): Promise<ProfileVisibility> {
    const response = await firstValueFrom(
      this.http.get<PrivacySettingsResponse>(`${this.baseUrl}/me/privacy-settings`, {
        headers: this.getHeaders(),
      }),
    );

    return response.profile_visibility && isProfileVisibility(response.profile_visibility)
      ? response.profile_visibility
      : 'everyone';
  }

  async updateProfileVisibility(profileVisibility: ProfileVisibility): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/me/privacy`,
        { profile_visibility: profileVisibility },
        { headers: this.getHeaders() },
      ),
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
