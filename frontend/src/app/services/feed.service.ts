import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';

export interface MomentAuthor {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  native_languages?: string[];
  target_languages?: string[];
}

export interface Moment {
  id: string;
  author_id: string;
  content_text?: string;
  media_urls?: string[];
  voice_note_url?: string;
  detected_language?: string;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: MomentAuthor;
}

export interface CreateMomentPayload {
  content_text?: string;
  media_urls?: string[];
  voice_note_url?: string;
  detected_language?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FeedService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private baseUrl = `${environment.apiUrl}/feed`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async getFeed(filter?: 'all' | 'classmates' | 'following'): Promise<Moment[]> {
    let params = new HttpParams();
    if (filter) {
      params = params.set('filter', filter);
    }

    const moments = await firstValueFrom(
      this.http.get<Moment[]>(`${this.baseUrl}`, {
        headers: this.getHeaders(),
        params,
      }),
    );

    // Apply client-side blocklist filtering (both directions)
    const currentUser = this.authService.currentUser();
    if (currentUser?.id) {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
      if (blockedIds.length > 0) {
        return moments.filter((moment) => !blockedIds.includes(moment.author_id));
      }
    }

    return moments;
  }

  async getMomentById(momentId: string): Promise<Moment | null> {
    try {
      const moment = await firstValueFrom(
        this.http.get<Moment>(`${this.baseUrl}/${momentId}`, {
          headers: this.getHeaders(),
        }),
      );

      // Check if author is blocked
      const blockedIds = await this.safetyService.getBlockedIdsAsync();
      if (blockedIds.includes(moment.author_id)) {
        return null;
      }

      return moment;
    } catch {
      return null;
    }
  }

  async createMoment(payload: CreateMomentPayload): Promise<Moment> {
    return firstValueFrom(
      this.http.post<Moment>(`${this.baseUrl}`, payload, {
        headers: this.getHeaders(),
      }),
    );
  }

  async deleteMoment(momentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/${momentId}`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async likeMoment(momentId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/${momentId}/like`,
        {},
        {
          headers: this.getHeaders(),
        },
      ),
    );
  }

  async unlikeMoment(momentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/${momentId}/like`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async getComments(momentId: string): Promise<unknown[]> {
    return firstValueFrom(
      this.http.get<unknown[]>(`${this.baseUrl}/${momentId}/comments`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async addComment(momentId: string, content: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `${this.baseUrl}/${momentId}/comments`,
        { content },
        {
          headers: this.getHeaders(),
        },
      ),
    );
  }
}
