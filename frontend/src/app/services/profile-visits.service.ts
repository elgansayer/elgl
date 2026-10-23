import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  ProfileVisitorsPage,
  RecordProfileVisitResponse,
} from '../interfaces/profile-visit.interface';

@Injectable({ providedIn: 'root' })
export class ProfileVisitsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/profile-visits`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async getMyVisitors(limit = 20, offset = 0): Promise<ProfileVisitorsPage> {
    return firstValueFrom(
      this.http.get<ProfileVisitorsPage>(`${this.baseUrl}/my-visitors`, {
        headers: this.getHeaders(),
        params: {
          limit: String(limit),
          offset: String(offset),
        },
      }),
    );
  }

  async recordVisit(viewedId: string): Promise<RecordProfileVisitResponse> {
    return firstValueFrom(
      this.http.post<RecordProfileVisitResponse>(`${this.baseUrl}/${viewedId}`, null, {
        headers: this.getHeaders(),
      }),
    );
  }
}
