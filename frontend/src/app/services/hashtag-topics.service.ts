import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import type { MomentRecord } from './moments.store';

export interface HashtagTopicSummary {
  hashtag: string;
  count: number;
  is_following: boolean;
}

export interface HashtagFeedResponse {
  hashtag: string;
  is_following: boolean;
  moments: MomentRecord[];
}

@Injectable({ providedIn: 'root' })
export class HashtagTopicsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/moments/topics`;

  async getFollowing(): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.get<{ hashtags: string[] }>(`${this.baseUrl}/following`, {
        headers: this.headers(),
      }),
    );
    return this.validateHashtagList(response?.hashtags);
  }

  async getTrending(limit = 8): Promise<HashtagTopicSummary[]> {
    const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)));
    const response = await firstValueFrom(
      this.http.get<HashtagTopicSummary[]>(`${this.baseUrl}/trending`, {
        headers: this.headers(),
        params: new HttpParams().set('limit', String(safeLimit)),
      }),
    );

    if (!Array.isArray(response) || response.length > safeLimit) {
      throw new Error('Invalid trending topics response');
    }

    const seen = new Set<string>();
    return response.map((item) => {
      const hashtag = this.validateHashtag(item?.hashtag);
      if (
        seen.has(hashtag) ||
        !Number.isInteger(item?.count) ||
        item.count < 1 ||
        typeof item?.is_following !== 'boolean'
      ) {
        throw new Error('Invalid trending topics response');
      }
      seen.add(hashtag);
      return { hashtag, count: item.count, is_following: item.is_following };
    });
  }

  async getHashtagFeed(hashtag: string): Promise<HashtagFeedResponse> {
    const normalized = this.validateHashtag(hashtag);
    const response = await firstValueFrom(
      this.http.get<HashtagFeedResponse>(
        `${this.baseUrl}/hashtag/${encodeURIComponent(normalized)}`,
        { headers: this.headers() },
      ),
    );

    if (
      this.validateHashtag(response?.hashtag) !== normalized ||
      typeof response?.is_following !== 'boolean' ||
      !Array.isArray(response?.moments) ||
      response.moments.length > 50
    ) {
      throw new Error('Invalid hashtag feed response');
    }

    return response;
  }

  async follow(hashtag: string): Promise<void> {
    const normalized = this.validateHashtag(hashtag);
    const response = await firstValueFrom(
      this.http.post<{ hashtag: string; is_following: boolean }>(
        `${this.baseUrl}/follow`,
        { hashtag: normalized },
        { headers: this.headers() },
      ),
    );
    if (this.validateHashtag(response?.hashtag) !== normalized || response.is_following !== true) {
      throw new Error('Invalid follow response');
    }
  }

  async unfollow(hashtag: string): Promise<void> {
    const normalized = this.validateHashtag(hashtag);
    const response = await firstValueFrom(
      this.http.delete<{ hashtag: string; is_following: boolean }>(
        `${this.baseUrl}/${encodeURIComponent(normalized)}`,
        { headers: this.headers() },
      ),
    );
    if (this.validateHashtag(response?.hashtag) !== normalized || response.is_following !== false) {
      throw new Error('Invalid unfollow response');
    }
  }

  private headers(): Record<string, string> {
    const token = this.authService.getAccessToken();
    if (!token) throw new Error('Authentication required');
    return { Authorization: `Bearer ${token}` };
  }

  private validateHashtagList(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 100) {
      throw new Error('Invalid followed topics response');
    }
    const seen = new Set<string>();
    return value.map((item) => {
      const hashtag = this.validateHashtag(item);
      if (seen.has(hashtag)) throw new Error('Invalid followed topics response');
      seen.add(hashtag);
      return hashtag;
    });
  }

  private validateHashtag(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Invalid hashtag');
    const hashtag = value.normalize('NFKC').trim().replace(/^#+/, '').toLocaleLowerCase();
    if (!/^[\p{L}\p{N}_]{1,50}$/u.test(hashtag)) throw new Error('Invalid hashtag');
    return hashtag;
  }
}
