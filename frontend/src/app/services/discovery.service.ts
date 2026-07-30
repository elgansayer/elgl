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
  gender?: string;
  age_min?: number;
  age_max?: number;
  interests?: string;
  sort?: string;
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

  private async getPartnerOfWeekIds(): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.baseUrl}/partner-of-week`, {
          headers: this.getHeaders(),
        }),
      );
    } catch {
      return [];
    }
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
    if (filters.gender) params = params.set('gender', filters.gender);
    if (filters.age_min !== undefined)
      params = params.set('age_min', filters.age_min.toString());
    if (filters.age_max !== undefined)
      params = params.set('age_max', filters.age_max.toString());
    if (filters.interests)
      params = params.set('interests', filters.interests);

    if (filters.sort)
      params = params.set('sort', filters.sort);

    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/partners`, { headers: this.getHeaders(), params })
        .pipe(catchError(() => of(MOCK_PARTNERS))),
    );

    // Filter out blocked users client-side
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }

    // Attach is_partner_of_week flag using separate endpoint
    const partnerIds = await this.getPartnerOfWeekIds();
    const partnerSet = new Set(partnerIds);
    let enriched = filtered.map((user) => ({
      ...user,
      is_partner_of_week: partnerSet.has(user.id),
    }));

    // Apply serious_learner_only filter if requested
    if (filters.serious_learner_only) {
      enriched = enriched.filter((user) => (user as any).is_serious_learner === true);
    }

    // Return enriched array, but keep the same UserProfile type (extra property is allowed in structural typing)
    return enriched;
  }

  async getAudioIntros(filters?: SearchFilterParams): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (filters?.native_languages) params = params.set('native_languages', filters.native_languages);
    if (filters?.target_language) params = params.set('target_language', filters.target_language);
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/audio-intros`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of([] as UserProfile[]))),
    );
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }
    return filtered;
  }

  async findByLanguagePair(
    nativeLanguage?: string,
    targetLanguage?: string,
  ): Promise<UserProfile[]> {
    let params = new HttpParams();
    if (nativeLanguage) params = params.set('native_language', nativeLanguage);
    if (targetLanguage) params = params.set('target_language', targetLanguage);
    const users = await firstValueFrom(
      this.http
        .get<UserProfile[]>(`${this.baseUrl}/language-pair`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of([] as UserProfile[]))),
    );
    const currentUser = this.authService.currentUser();
    let filtered = users;
    if (currentUser?.id) {
      const blockedIds = await this.safetyService
        .getBlockedAndBlockerIds(currentUser.id)
        .catch((): string[] => []);
      if (blockedIds.length > 0) {
        filtered = filtered.filter((user) => !blockedIds.includes(user.id));
      }
    }
    return filtered;
  }

  async translateBio(bioText: string): Promise<string> {
    const currentUser = this.authService.currentUser();
    const targetLanguage = currentUser?.native_languages?.[0] ?? 'en';
    try {
      const result = await firstValueFrom(
        this.http.post<{ translatedText: string }>(
          `${environment.apiUrl}/nlp/translate`,
          { text: bioText, sourceLanguage: '', targetLanguage },
          { headers: this.getHeaders() }
        )
      );
      return result.translatedText;
    } catch {
      return bioText;
    }
  }
}
