import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { UserProfile } from './user.service';

export interface SearchFilterParams {
  latitude?: number;
  longitude?: number;
  radius_metres?: number;
  native_language?: string;
  target_language?: string;
  serious_learner_only?: boolean;
  level?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiscoveryService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/discovery`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async findPartners(filters: SearchFilterParams): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (filters.latitude !== undefined) params = params.set('latitude', filters.latitude.toString());
    if (filters.longitude !== undefined) params = params.set('longitude', filters.longitude.toString());
    if (filters.radius_metres !== undefined) params = params.set('radius_metres', filters.radius_metres.toString());
    if (filters.native_language) params = params.set('native_language', filters.native_language);
    if (filters.target_language) params = params.set('target_language', filters.target_language);
    if (filters.serious_learner_only !== undefined) params = params.set('serious_learner_only', filters.serious_learner_only.toString());
    if (filters.level) params = params.set('level', filters.level);

    return firstValueFrom(
      this.http.get<UserProfile[]>(`${this.baseUrl}/partners`, { headers: this.getHeaders(), params })
    );
  }
}
