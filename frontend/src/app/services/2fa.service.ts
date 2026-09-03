import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class TwoFactorService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly apiUrl = '/api';

  async enable(): Promise<{ secret: string; qrCodeUrl: string }> {
    return lastValueFrom(
      this.http.post<{ secret: string; qrCodeUrl: string }>(
        `${this.apiUrl}/auth/two-factor/enable`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.authService.getAccessToken()}`,
          },
        },
      ),
    );
  }

  async verify(token: string): Promise<boolean> {
    const res = await lastValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/auth/two-factor/verify`,
        { token },
        {
          headers: {
            Authorization: `Bearer ${this.authService.getAccessToken()}`,
          },
        },
      ),
    );
    return res.success;
  }

  async disable(token: string): Promise<boolean> {
    const res = await lastValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/auth/two-factor/disable`,
        { token },
        {
          headers: {
            Authorization: `Bearer ${this.authService.getAccessToken()}`,
          },
        },
      ),
    );
    return res.success;
  }

  async checkStatus(): Promise<boolean> {
    const res = await lastValueFrom(
      this.http.get<{ enabled: boolean }>(
        `${this.apiUrl}/auth/two-factor/status`,
        {
          headers: {
            Authorization: `Bearer ${this.authService.getAccessToken()}`,
          },
        },
      ),
    );
    return res.enabled;
  }
}
