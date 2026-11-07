import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  ProfileVisitorsPage,
  RecordProfileVisitResponse,
} from '../interfaces/profile-visit.interface';
import { normaliseProfileVisitorsPage } from './profile-visits.normaliser';

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

  /**
   * Loads one bounded page of the owner's visitors. The server decides whether identities are
   * visible; the response is still normalised here so every consumer receives a page that has
   * already had masked identities removed (see `normaliseProfileVisitorsPage`).
   */
  async getMyVisitors(limit = 20, offset = 0): Promise<ProfileVisitorsPage> {
    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/my-visitors`, {
        headers: this.getHeaders(),
        params: {
          limit: String(limit),
          offset: String(offset),
        },
      }),
    );

    return normaliseProfileVisitorsPage(response, { limit, offset });
  }

  async recordVisit(viewedId: string): Promise<RecordProfileVisitResponse> {
    return firstValueFrom(
      this.http.post<RecordProfileVisitResponse>(`${this.baseUrl}/${viewedId}`, null, {
        headers: this.getHeaders(),
      }),
    );
  }
}
