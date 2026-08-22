import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ProfileVisibility = 'everyone' | 'vips_only' | 'hidden';

interface ProfileVisibilityResponse {
  profile_visibility?: unknown;
}

@Injectable({ providedIn: 'root' })
export class ProfileVisibilityService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  async get(): Promise<ProfileVisibility> {
    const response = await firstValueFrom(
      this.http.get<ProfileVisibilityResponse>(`${this.baseUrl}/me/privacy-settings`, {
        headers: this.getHeaders(),
      }),
    );

    if (!this.isProfileVisibility(response.profile_visibility)) {
      throw new Error('Profile visibility response is invalid');
    }
    return response.profile_visibility;
  }

  async set(value: ProfileVisibility): Promise<ProfileVisibility> {
    const response = await firstValueFrom(
      this.http.patch<ProfileVisibilityResponse>(
        `${this.baseUrl}/me/privacy`,
        { profile_visibility: value },
        { headers: this.getHeaders() },
      ),
    );

    if (response.profile_visibility !== value) {
      throw new Error('Profile visibility update was not persisted');
    }
    return value;
  }

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return { Authorization: `Bearer ${token}` };
  }

  private isProfileVisibility(value: unknown): value is ProfileVisibility {
    return value === 'everyone' || value === 'vips_only' || value === 'hidden';
  }
}
