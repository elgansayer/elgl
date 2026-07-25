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
  avatar_url?: string;
  audio_intro_url?: string;
  cover_photo_url?: string;
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
  privacy_hide_gender: boolean;
  distance_metres?: number;
  created_at: string;
  is_followed_by_me?: boolean;
  is_liked_by_me?: boolean;
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

@Injectable({
  providedIn: 'root'
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
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async getMyProfile(): Promise<UserProfile | null> {
    return firstValueFrom(
      this.http.get<UserProfile>(`${this.baseUrl}/me`, { headers: this.getHeaders() }).pipe(
        catchError(() => of(MOCK_USER_PROFILE))
      )
    );
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return firstValueFrom(
      this.http.get<UserProfile>(`${this.baseUrl}/${userId}`, { headers: this.getHeaders() }).pipe(
        catchError(() => {
          const user = [MOCK_USER_PROFILE, ...MOCK_PARTNERS].find(u => u.id === userId);
          return of(user || null);
        })
      )
    );
  }

  async followUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${userId}/follow`, {}, { headers: this.getHeaders() }).pipe(
        catchError(() => of(undefined))
      )
    );
  }

  async unfollowUser(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/${userId}/follow`, { headers: this.getHeaders() }).pipe(
        catchError(() => of(undefined))
      )
    );
  }

  async likeProfile(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/${userId}/like`, {}, { headers: this.getHeaders() }).pipe(
        catchError(() => of(undefined))
      )
    );
  }

  async updateMyProfile(update: Partial<UserProfile> & { location?: { latitude: number; longitude: number }; mock_location?: { latitude: number; longitude: number } }): Promise<UserProfile> {
    return firstValueFrom(
      this.http.patch<UserProfile>(`${this.baseUrl}/me`, update, { headers: this.getHeaders() }).pipe(
        catchError(() => {
          const updated = { ...MOCK_USER_PROFILE, ...update } as UserProfile;
          return of(updated);
        })
      )
    );
  }

  async getMyVisitors(): Promise<VisitorLog[]> {
    return firstValueFrom(
      this.http.get<VisitorLog[]>(`${this.visitsUrl}/my-visitors`, { headers: this.getHeaders() })
    );
  }

  async getProfileVisitors(): Promise<ProfileVisitor[]> {
    return firstValueFrom(
      this.http.get<ProfileVisitor[]>(`${this.baseUrl}/me/visitors`, { headers: this.getHeaders() }).pipe(
        catchError(() => of(MOCK_VISITORS))
      )
    );
  }

  async recordVisit(viewedUserId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.visitsUrl}/${viewedUserId}`, {}, { headers: this.getHeaders() })
    );
  }

  async getPresignedUploadUrl(filename: string, contentType: string, folder: string): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
        `${this.mediaUrl}/presigned-url`,
        { filename, contentType, folder },
        { headers: this.getHeaders() }
      )
    );
  }

  async getPresignedCoverPhotoUrl(filename: string, contentType: string): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; mediaUrl: string; objectKey: string }>(
        `${this.baseUrl}/me/cover-photo/presigned-url`,
        { filename, contentType },
        { headers: this.getHeaders() }
      )
    );
  }

  async updateCoverPhotoUrl(coverPhotoUrl: string): Promise<UserProfile> {
    return firstValueFrom(
      this.http.patch<UserProfile>(
        `${this.baseUrl}/me/cover-photo`,
        { cover_photo_url: coverPhotoUrl },
        { headers: this.getHeaders() }
      )
    );
  }

  async uploadCoverPhoto(file: File): Promise<string> {
    const { uploadUrl, mediaUrl } = await this.getPresignedCoverPhotoUrl(
      file.name,
      file.type
    );

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
}
