import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ProfileVisit } from '../interfaces/profile-visit.interface';

@Injectable({ providedIn: 'root' })
export class ProfileVisitsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/profile-visits`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async getMyVisitors(): Promise<ProfileVisit[]> {
    return firstValueFrom(
      this.http.get<ProfileVisit[]>(`${this.baseUrl}/my-visitors`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async recordVisit(viewedId: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${viewedId}`, null, {
        headers: this.getHeaders(),
      }),
    );
  }
}
