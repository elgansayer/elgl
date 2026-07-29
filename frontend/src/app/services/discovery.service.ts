import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { MOCK_PARTNERS } from './mock-data';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { UserProfile } from './user.service';

export interface SearchFilterParams {
  latitude?: number;
  longitude?: number;
  radius_metres?: number;
  native_languages?: string;
  target_language?: string;
  serious_learner_only?: boolean;
  level?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DiscoveryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private baseUrl = `${environment.apiUrl}/discovery`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async findPartners(filters: SearchFilterParams): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (filters.latitude !== undefined)
      params = params.set('latitude', filters.latitude.toString());
    if (filters.longitude !== undefined)
      params = params.set('longitude', filters.longitude.toString());
    if (filters.radius_metres !== undefined)
      params = params.set('radius_metres', filters.radius_metres.toString());
    if (filters.native_languages) params = params.set('native_languages', filters.native_languages);
    if (filters.target_language) params = params.set('target_language', filters.target_language);
    if (filters.serious_learner_only !== undefined)
      params = params.set('serious_learner_only', filters.serious_learner_only.toString());
    if (filters.level) params = params.set('level', filters.level);

    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/partners`, { headers: this.getHeaders(), params })
        .pipe(catchError(() => of(MOCK_PARTNERS))),
    );

    // Filter out blocked users client-side
    const currentUser = this.authService.currentUser();
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        return users.filter((user) => !blockedIds.includes(user.id));
      }
    }

    return users;
  }
}
