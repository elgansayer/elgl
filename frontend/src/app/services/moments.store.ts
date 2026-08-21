import { showToast } from './toast.service';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { HapticFeedbackService } from './haptic-feedback.service';

export interface MomentComment {
  id: string;
  moment_id: string;
  user_id: string;
  text_content?: string;
  correction_payload?: {
    original: string;
    corrected: string;
    explanation?: string;
  };
  parent_comment_id?: string;
  reply_to_user_id?: string;
  created_at: string;
  upVotes?: number;
  downVotes?: number;
  userVote?: string | null;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface VoteCorrectionResponse {
  commentId: string;
  vote: string;
  upVotes: number;
  downVotes: number;
  userVote: string | null;
}

export interface MomentRecord {
  id: string;
  user_id: string;
  text_content?: string;
  media_urls?: string[];
  media_type: 'none' | 'images' | 'audio';
  target_language: string;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  is_liked_by_me?: boolean;
  comments?: MomentComment[];

  // Translation cache managed by moments-feed component
  isTranslating?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MomentsStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private hapticFeedback = inject(HapticFeedbackService);
  private baseUrl = `${environment.apiUrl}/moments`;

  readonly feed = signal<MomentRecord[]>([]);
  readonly activeFilter = signal<'All' | 'Classmates' | 'Following' | 'For You'>('All');
  readonly isLoading = signal<boolean>(false);

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async loadFeed(
    filter?: 'All' | 'Classmates' | 'Following' | 'For You',
    lang?: string,
  ): Promise<void> {
    const targetFilter = filter ?? this.activeFilter();
    this.activeFilter.set(targetFilter);
    this.isLoading.set(true);

    let params = new HttpParams().set('filter', targetFilter);
    if (lang) {
      params = params.set('lang', lang);
    }

    try {
      const list = await firstValueFrom(
        this.http
          .get<MomentRecord[]>(`${this.baseUrl}/feed`, {
            headers: this.getHeaders(),
            params,
          })
          .pipe(catchError(() => of<MomentRecord[]>([]))),
      );
      this.feed.set(list);
    } catch (e) {
      console.error('Failed to load moments feed:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createMoment(payload: {
    text_content?: string;
    media_urls?: string[];
    media_type?: 'none' | 'images' | 'audio';
    target_language: string;
  }): Promise<MomentRecord> {
    const created = await firstValueFrom(
      this.http.post<MomentRecord>(this.baseUrl, payload, { headers: this.getHeaders() }),
    );
    this.feed.update((list) => [created, ...list]);
    return created;
  }

  async toggleLike(momentId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ likes_count: number; is_liked: boolean }>(
          `${this.baseUrl}/${momentId}/like`,
          {},
          { headers: this.getHeaders() },
        ),
      );
      this.hapticFeedback.success();
      this.feed.update((list) =>
        list.map((m) => {
          if (m.id === momentId) {
            return { ...m, likes_count: res.likes_count, is_liked_by_me: res.is_liked };
          }
          return m;
        }),
      );
    } catch (e) {
      console.error('Failed to toggle moment like:', e);
    }
  }

  async loadComments(momentId: string): Promise<MomentComment[]> {
    try {
      const list = await firstValueFrom(
        this.http.get<MomentComment[]>(`${this.baseUrl}/${momentId}/comments`, {
          headers: this.getHeaders(),
        }),
      );
      this.feed.update((moments) =>
        moments.map((m) => (m.id === momentId ? { ...m, comments: list } : m)),
      );
      return list;
    } catch (e) {
      console.error('Failed to load comments:', e);
      return [];
    }
  }

  async addComment(
    momentId: string,
    payload: {
      text_content?: string;
      correction_payload?: {
        original: string;
        corrected: string;
        explanation?: string;
      };
      parent_comment_id?: string;
      reply_to_user_id?: string;
    },
  ): Promise<MomentComment> {
    const created = await firstValueFrom(
      this.http.post<MomentComment>(`${this.baseUrl}/${momentId}/comments`, payload, {
        headers: this.getHeaders(),
      }),
    );
    this.feed.update((list) =>
      list.map((m) => {
        if (m.id === momentId) {
          const existing = m.comments ?? [];
          return {
            ...m,
            comments_count: (m.comments_count ?? 0) + 1,
            comments: [...existing, created],
          };
        }
        return m;
      }),
    );
    return created;
  }

  async voteOnCorrection(
    momentId: string,
    commentId: string,
    vote: 'up' | 'down',
  ): Promise<VoteCorrectionResponse> {
    const res = await firstValueFrom(
      this.http.post<VoteCorrectionResponse>(
        `${this.baseUrl}/${momentId}/comments/${commentId}/vote`,
        { vote },
        { headers: this.getHeaders() },
      ),
    );
    this.feed.update((list) =>
      list.map((m) => {
        if (m.id !== momentId) return m;
        const comments = (m.comments ?? []).map((c) =>
          c.id === commentId
            ? { ...c, upVotes: res.upVotes, downVotes: res.downVotes, userVote: res.userVote }
            : c,
        );
        return { ...m, comments };
      }),
    );
    return res;
  }

  async togglePin(momentId: string): Promise<void> {
    try {
      const updated = await firstValueFrom(
        this.http.patch<MomentRecord>(
          `${this.baseUrl}/${momentId}/pin`,
          {},
          { headers: this.getHeaders() },
        ),
      );
      this.feed.update((list) => {
        const next = list.map((m) =>
          m.id === momentId ? { ...m, is_pinned: updated.is_pinned } : m,
        );
        return next.sort((a, b) => {
          if (a.is_pinned === b.is_pinned) return 0;
          return a.is_pinned ? -1 : 1;
        });
      });
    } catch (e: unknown) {
      console.error('Failed to pin moment:', e);
      const message = e instanceof Error ? e.message : String(e);
      showToast(
        message ||
          'Error pinning Moment. Ensure you have an active VIP subscription (8 UKP / $10 USD).',
      );
    }
  }
}
