import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface UserProfile {
  id: string;
  display_name?: string;
  native_language: string;
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
  distance_metres?: number;
  created_at: string;
}

export interface VisitorLog {
  id: string;
  created_at: string;
  is_blurred: boolean;
  visitor: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    native_language: string;
    target_languages: string[];
    bio_text?: string;
    is_vip?: boolean;
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
      this.http.get<UserProfile>(`${this.baseUrl}/me`, { headers: this.getHeaders() })
    );
  }

  async updateMyProfile(update: Partial<UserProfile> & { location?: { latitude: number; longitude: number }; mock_location?: { latitude: number; longitude: number } }): Promise<UserProfile> {
    return firstValueFrom(
      this.http.patch<UserProfile>(`${this.baseUrl}/me`, update, { headers: this.getHeaders() })
    );
  }

  async getMyVisitors(): Promise<VisitorLog[]> {
    return firstValueFrom(
      this.http.get<VisitorLog[]>(`${this.visitsUrl}/my-visitors`, { headers: this.getHeaders() })
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
    const { uploadUrl, mediaUrl } = await this.getPresignedUploadUrl(
      file.name,
      file.type,
      'cover-photos'
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
