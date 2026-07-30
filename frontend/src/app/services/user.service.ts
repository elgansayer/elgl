import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { MOCK_USER_PROFILE, MOCK_VISITORS, MOCK_PARTNERS } from './mock-data';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface UserProfile {
  id: string;
  display_name?: string;
  native_languages: string[];
  target_languages: string[];
  bio_text?: string;
  status_text?: string;
  avatar_url?: string;
  audio_intro_url?: string;
  cover_photo_url?: string;
  primary_accent_color?: string;
  interests?: string[];
  hobbies?: string[];
  is_vip: boolean;
  vip_tier: string;
  coins_balance: number;
  study_streak_days: number;
  correction_ratio: number;
  is_serious_learner: boolean;
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  gender?: string;
  nationality?: string;
  region?: string;
  age?: number;
  privacy_hide_gender: boolean;
  privacy_hide_exact_location?: boolean;
  privacy_hide_online_status?: boolean;
  incognito_visits?: boolean;
  silence_unknown_callers?: boolean;
  status_visibility?: string;
  auto_play_voice_notes?: boolean;
  auto_download_media?: boolean;
  distance_metres?: number;
  is_admin?: boolean;
  profile_visibility?: 'everyone' | 'vips_only' | 'hidden';
  proficiency_level?: string;
  learning_goals?: string;
  created_at: string;
  is_followed_by_me?: boolean;
  is_liked_by_me?: boolean;
  corrector_score?: number;
  privacy_last_seen?: string;
  privacy_profile_photo?: string;
  privacy_about_info?: string;
  privacy_status?: string;
  business_name?: string;
  business_hours?: string;
  website_url?: string;
  catalog?: BusinessCatalogItem[];
}

export interface BusinessCatalogItem {
  id?: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
}

export interface VisitorLog {
  id: string;
  created_at: string;
  is_blurred: boolean;
  visitor: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    native_languages: string[];
    target_languages: string[];
    bio_text?: string;
    is_vip?: boolean;
  };
}

export interface ProfileVisitor {
  id: string;
  visitor_id: string;
  viewed_id: string;
  created_at: string;
  visitor?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
    native_languages?: string[];
    target_languages?: string[];
  };
}

export interface LinkedAccount {
  provider: string;
  /** Display name of the linked account (e.g. email) */
  name?: string;
  /** Whether the link is active */
  active: boolean;
  /** When the link was created */
  created_at?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/users`;
  private visitsUrl = `${environment.apiUrl}/profile-visits`;
  private mediaUrl = `${environment.apiUrl}/media`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async getMyProfile(): Promise<UserProfile | null> {
    return firstValueFrom(
      this.http
        .get<UserProfile>(`${this.baseUrl}/me`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({...MOCK_USER_PROFILE, status_text:'Learning new languages!'}))),
    );
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return firstValueFrom(
      this.http.get<UserProfile>(`${this.baseUrl}/${userId}`, { headers: this.getHeaders() }).pipe(
        catchError(() => {
          const user = [MOCK_USER_PROFILE, ...MOCK_PARTNERS].find((u) => u.id === userId);
          return of(user || null);
        }),
      ),
    );
  }

  async followUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http
        .post<void>(`${this.baseUrl}/${userId}/follow`, {}, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async unfollowUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http
        .delete<void>(`${this.baseUrl}/${userId}/follow`, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async likeProfile(userId: string): Promise<void> {
    return firstValueFrom(
      this.http
        .post<void>(`${this.baseUrl}/${userId}/like`, {}, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async updateMyProfile(
    update: Partial<UserProfile> & {
      location?: { latitude: number; longitude: number };
      mock_location?: { latitude: number; longitude: number };
    },
  ): Promise<UserProfile> {
    return firstValueFrom(
      this.http
        .patch<UserProfile>(`${this.baseUrl}/me`, update, { headers: this.getHeaders() })
        .pipe(
          catchError(() => {
            const updated: UserProfile = { ...MOCK_USER_PROFILE, status_text:'Learning new languages!', ...update };
            return of(updated);
          }),
        ),
    );
  }

  async getMyVisitors(): Promise<VisitorLog[]> {
    return firstValueFrom(
      this.http.get<VisitorLog[]>(`${this.visitsUrl}/my-visitors`, { headers: this.getHeaders() }),
    );
  }

  async getProfileVisitors(): Promise<ProfileVisitor[]> {
    return firstValueFrom(
      this.http
        .get<ProfileVisitor[]>(`${this.baseUrl}/me/visitors`, { headers: this.getHeaders() })
        .pipe(catchError(() => of(MOCK_VISITORS))),
    );
  }

  async recordVisit(viewedUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.visitsUrl}/${viewedUserId}`, {}, { headers: this.getHeaders() }),
    );
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    folder: string,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
        `${this.mediaUrl}/presigned-url`,
        { filename, contentType, folder },
        { headers: this.getHeaders() },
      ),
    );
  }

  async getPresignedCoverPhotoUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
        `${this.baseUrl}/me/cover-photo/presigned-url`,
        { filename, contentType },
        { headers: this.getHeaders() },
      ),
    );
  }

  async getPresignedAvatarUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
        `${this.baseUrl}/me/avatar/presigned-url`,
        { filename, contentType },
        { headers: this.getHeaders() },
      ),
    );
  }

  async uploadAvatar(file: File): Promise<string> {
    const { uploadUrl, mediaUrl } = await this.getPresignedAvatarUrl(file.name, file.type);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload avatar');
    }

    return mediaUrl;
  }

  async updateCoverPhotoUrl(coverPhotoUrl: string): Promise<UserProfile> {
    return firstValueFrom(
      this.http.patch<UserProfile>(
        `${this.baseUrl}/me/cover-photo`,
        { cover_photo_url: coverPhotoUrl },
        { headers: this.getHeaders() },
      ),
    );
  }

  async uploadCoverPhoto(file: File): Promise<string> {
    const { uploadUrl, mediaUrl } = await this.getPresignedCoverPhotoUrl(file.name, file.type);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload cover photo');
    }

    return mediaUrl;
  }

  async downloadMyData(): Promise<void> {
    const data = await firstValueFrom(
      this.http.get(`${this.baseUrl}/me/export`, { headers: this.getHeaders() }),
    );

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_data_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async rateCorrector(ratedUserId: string, score: number): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${environment.apiUrl}/corrector-score/rate`,
        { rated_user_id: ratedUserId, score },
        { headers: this.getHeaders() },
      ).pipe(catchError(() => of(undefined))),
    );
  }

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    return firstValueFrom(
      this.http
        .get<LinkedAccount[]>(`${this.baseUrl}/me/linked-accounts`, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of([]))),
    );
  }

  async getMyPrivacySettings(): Promise<{
    privacy_hide_age: boolean;
    privacy_hide_location: boolean;
    privacy_hide_from_search: boolean;
    privacy_hide_gender: boolean;
    privacy_last_seen?: string;
    privacy_profile_photo?: string;
    privacy_about_info?: string;
    privacy_status?: string;
    privacy_hide_exact_location: boolean;
    privacy_hide_online_status: boolean;
  }> {
    return firstValueFrom(
      this.http
        .get<{
          privacy_hide_age: boolean;
          privacy_hide_location: boolean;
          privacy_hide_from_search: boolean;
          privacy_hide_gender: boolean;
          privacy_last_seen?: string;
          privacy_profile_photo?: string;
          privacy_about_info?: string;
          privacy_status?: string;
          privacy_hide_exact_location: boolean;
          privacy_hide_online_status: boolean;
        }>(`${this.baseUrl}/me/privacy-settings`, { headers: this.getHeaders() })
        .pipe(
          catchError(() => {
            const profile = MOCK_USER_PROFILE;
            return of({
              privacy_hide_age: profile.privacy_hide_age ?? false,
              privacy_hide_location: profile.privacy_hide_location ?? false,
              privacy_hide_from_search: profile.privacy_hide_from_search ?? false,
              privacy_hide_gender: profile.privacy_hide_gender ?? false,
              privacy_last_seen: (profile as any)?.privacy_last_seen ?? 'everyone',
              privacy_profile_photo: (profile as any)?.privacy_profile_photo ?? 'everyone',
              privacy_about_info: (profile as any)?.privacy_about_info ?? 'everyone',
              privacy_status: (profile as any)?.privacy_status ?? 'everyone',
              privacy_hide_exact_location: profile.privacy_hide_exact_location ?? false,
              privacy_hide_online_status: profile.privacy_hide_online_status ?? false,
            });
          }),
        ),
    );
  }

  async linkAccount(provider: string): Promise<void> {
    return firstValueFrom(
      this.http
        .post<void>(
          `${this.baseUrl}/me/linked-accounts/link`,
          { provider },
          { headers: this.getHeaders() },
        )
        .pipe(catchError(() => of(undefined))),
    );
  }

  async unlinkAccount(provider: string): Promise<void> {
    return firstValueFrom(
      this.http
        .post<void>(
          `${this.baseUrl}/me/linked-accounts/unlink`,
          { provider },
          { headers: this.getHeaders() },
        )
        .pipe(catchError(() => of(undefined))),
    );
  }

  getMilestoneForStreak(streakDays: number): number | null {
    if (streakDays >= 100) return 100;
    if (streakDays >= 30) return 30;
    if (streakDays >= 7) return 7;
    return null;
  }

  async getStudyStreak(): Promise<number> {
    const stats = await firstValueFrom(
      this.http.get<Partial<UserProfile>>(`${this.baseUrl}/me/stats`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({} as Partial<UserProfile>)))
    );
    return stats?.study_streak_days ?? 0;
  }

  async getAvailableHobbies(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/hobbies`, { headers: this.getHeaders() })
        .pipe(catchError(() => {
          // fallback to mock
          return of(['reading', 'travelling', 'gaming', 'cooking', 'sports', 'music', 'photography']);
        })),
    );
  }

  async getAvailableInterests(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/interests`, { headers: this.getHeaders() })
        .pipe(catchError(() => {
          // fallback to mock
          return of(['technology', 'fashion', 'food', 'travel', 'art', 'science', 'history', 'fitness']);
        })),
    );
  }

  async getMyBadges(): Promise<Badge[]> {
    return firstValueFrom(
      this.http.get<Badge[]>(`${this.baseUrl}/me/badges`, { headers: this.getHeaders() })
        .pipe(catchError(() => of([]))),
    );
  }

  async getOverviewStats(): Promise<{
    translations_count: number;
    corrections_count: number;
    moments_count: number;
  }> {
    return firstValueFrom(
      this.http
        .get<{
          translations_count: number;
          corrections_count: number;
          moments_count: number;
        }>(`${this.baseUrl}/stats/me`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({ translations_count: 0, corrections_count: 0, moments_count: 0 }))),
    );
  }

  async updatePrivacySettings(settings: {
    privacy_last_seen?: string;
    privacy_profile_photo?: string;
    privacy_about_info?: string;
    privacy_status?: string;
    incognito_visits?: boolean;
    privacy_hide_exact_location?: boolean;
    privacy_hide_online_status?: boolean;
  }): Promise<UserProfile> {
    return firstValueFrom(
      this.http
        .patch<UserProfile>(`${this.baseUrl}/me/privacy`, settings, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of(MOCK_USER_PROFILE))),
    );
  }

  async blockUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${environment.apiUrl}/trust-safety/block`, { blocked_id: userId }, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async unblockUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${environment.apiUrl}/trust-safety/block/${userId}`, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async reportUser(reportedUserId: string, reasonCategory: string, description?: string, contextUrl?: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${environment.apiUrl}/trust-safety/report`, { reported_id: reportedUserId, reason_category: reasonCategory, description, context_url: contextUrl }, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async deleteMyAccount(): Promise<{ message: string; scheduled_for_deletion_at: string }> {
    return firstValueFrom(
      this.http
        .delete<{ message: string; scheduled_for_deletion_at: string }>(
          `${this.baseUrl}/me`,
          { headers: this.getHeaders() },
        )
        .pipe(catchError(() => of({ message: '', scheduled_for_deletion_at: '' }))),
    );
  }

  async restoreMyAccount(): Promise<{ message: string }> {
    return firstValueFrom(
      this.http
        .post<{ message: string }>(
          `${this.baseUrl}/me/restore`,
          {},
          { headers: this.getHeaders() },
        )
        .pipe(catchError(() => of({ message: '' }))),
    );
  }

  async getMessageFilters(): Promise<{
    age_min?: number;
    age_max?: number;
    allowed_genders?: string[];
    allowed_native_languages?: string[];
  }> {
    return firstValueFrom(
      this.http
        .get<{
          age_min?: number;
          age_max?: number;
          allowed_genders?: string[];
          allowed_native_languages?: string[];
        }>(`${this.baseUrl}/me/message-filters`, { headers: this.getHeaders() })
        .pipe(catchError(() => of({}))),
    );
  }

  async setMessageFilters(filters: {
    age_min?: number;
    age_max?: number;
    allowed_genders?: string[];
    allowed_native_languages?: string[];
  }): Promise<void> {
    return firstValueFrom(
      this.http
        .put<void>(`${this.baseUrl}/me/message-filters`, filters, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of(undefined))),
    );
  }
}
