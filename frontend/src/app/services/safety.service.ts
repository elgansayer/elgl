import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportUserDto {
  reported_id: string;
  reason_category: string;
  description?: string;
  context_url?: string;
}

export interface ReportResponse {
  success: boolean;
  message: string;
}

export interface ReportCategory {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface MomentFeedItem {
  id: string;
  author_id: string;
  content_text?: string | null;
  media_urls?: string[];
  voice_note_url?: string | null;
  detected_language?: string | null;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class SafetyService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Local cache for blocked user IDs (bidirectional: blocked + blocker)
  private _blockedUserIds = signal<Set<string>>(new Set());
  public readonly blockedUserIdsSignal = this._blockedUserIds.asReadonly();

  // Public read-only accessor (could be used for reactivity)
  get blockedUserIds(): ReadonlySet<string> {
    return this._blockedUserIds();
  }

  private readonly MUTED_WORDS_STORAGE_KEY = 'hellotalk_muted_words';

  private _mutedWords = signal<string[]>(
    (() => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.MUTED_WORDS_STORAGE_KEY);
        if (stored) {
          try {
            const arr: string[] = JSON.parse(stored);
            return Array.isArray(arr) ? arr : [];
          } catch {
            // ignore
          }
        }
      }
      return [];
    })(),
  );

  readonly mutedWords = this._mutedWords.asReadonly();

  private persistMutedWords(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.MUTED_WORDS_STORAGE_KEY, JSON.stringify(this._mutedWords()));
    }
  }

  addMutedWord(word: string): void {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    this._mutedWords.update(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
    this.persistMutedWords();
  }

  removeMutedWord(word: string): void {
    const trimmed = word.trim().toLowerCase();
    this._mutedWords.update(prev => prev.filter(w => w !== trimmed));
    this.persistMutedWords();
  }

  isMutedWord(word: string): boolean {
    return this._mutedWords().includes(word.trim().toLowerCase());
  }

  clearMutedWords(): void {
    this._mutedWords.set([]);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.MUTED_WORDS_STORAGE_KEY);
    }
  }

  /** Apply mute‑word filter to an array of moments. */
  filterMomentsByMutedWords(moments: MomentFeedItem[]): MomentFeedItem[] {
    if (!moments || moments.length === 0) return moments;
    const muted = this._mutedWords();
    if (muted.length === 0) return moments;
    return moments.filter(moment => {
      if (!moment.content_text) return true;
      const text: string = moment.content_text.toLowerCase();
      return !muted.some(word => text.includes(word));
    });
  }

  /**
   * Load the initial list of blocked user IDs from the backend.
   * Should be called once after user login / app init.
   */
  async loadBlockedUsers(): Promise<void> {
    try {
      const ids = await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`),
      );
      const newSet = new Set(ids);
      this._blockedUserIds.set(newSet);
    } catch (e) {
      console.error('Failed to load blocked user IDs', e);
    }
  }

  /** Synchronous cache-based check (fast, no network) */
  isUserBlockedCached(userId: string): boolean {
    return this._blockedUserIds().has(userId);
  }

  reportUser(dto: ReportUserDto): Promise<ReportResponse> {
    return firstValueFrom(this.http.post<ReportResponse>(`${this.apiUrl}/safety/report`, dto));
  }

  async reportUserAsync(dto: ReportUserDto): Promise<ReportResponse> {
    return this.reportUser(dto);
  }

  blockUser(blockedId: string): Promise<{ success: boolean; blocked_id: string }> {
    return firstValueFrom(
      this.http.post<{ success: boolean; blocked_id: string }>(
        `${this.apiUrl}/safety/block/${blockedId}`,
        {},
      ),
    );
  }

  async blockUserAsync(blockedId: string): Promise<{ success: boolean; blocked_id: string }> {
    const res = await this.blockUser(blockedId);
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.add(blockedId);
      return next;
    });
    return res;
  }

  unblockUser(blockedId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(`${this.apiUrl}/safety/unblock/${blockedId}`, {}),
    );
  }

  async unblockUserAsync(blockedId: string): Promise<{ success: boolean }> {
    const res = await this.unblockUser(blockedId);
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
    return res;
  }

  getBlockedIds(): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`));
  }

  async getBlockedIdsAsync(): Promise<string[]> {
    return this.getBlockedIds();
  }

  /** Returns report categories from the backend.
   *  The response must be localised using the Accept-Language header. */
  getReportCategories(): Promise<ReportCategory[]> {
    return firstValueFrom(
      this.http.get<ReportCategory[]>(`${this.apiUrl}/safety/report-categories`).pipe(
        catchError(() => {
          return of(this.getStaticReportCategories());
        }),
      ),
    );
  }

  getCategories(): Promise<ReportCategory[]> {
    return this.getReportCategories();
  }

  /** Static fallback category list used when the backend is unreachable. */
  getStaticReportCategories(): ReportCategory[] {
    return this.staticReportCategories;
  }

  private staticReportCategories: ReportCategory[] = [
    {
      value: 'harassment',
      label: 'Harassment',
      icon: '🚫',
      description: 'Unwanted advances, threats, or abusive behaviour',
    },
    {
      value: 'spam',
      label: 'Spam',
      icon: '📧',
      description: 'Unsolicited promotions, phishing, or fraudulent activity',
    },
    {
      value: 'inappropriate_content',
      label: 'Inappropriate Content',
      icon: '🔞',
      description: 'Sexually explicit, violent, or offensive material',
    },
    {
      value: 'fake_profile',
      label: 'Fake Profile',
      icon: '🎭',
      description: 'Pretending to be someone else or using false identity',
    },
    {
      value: 'other',
      label: 'Other',
      icon: '📝',
      description: 'Something else not listed above',
    },
  ];

  async getBlockedUserIds(userId: string): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids/${userId}`),
      );
    } catch (e) {
      console.error('Failed to get blocked user IDs:', e);
      return [];
    }
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocker-ids/${userId}`),
      );
    } catch (e) {
      console.error('Failed to get blocker user IDs:', e);
      return [];
    }
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`),
      );
    } catch (e) {
      console.error('Failed to get blocked and blocker IDs:', e);
      return [];
    }
  }

  async isBlocked(userId: string): Promise<{ blocked: boolean }> {
    // Use cache for a quick answer if possible
    if (this.isUserBlockedCached(userId)) {
      return { blocked: true };
    }
    try {
      return await firstValueFrom(
        this.http.get<{ blocked: boolean }>(`${this.apiUrl}/safety/is-blocked/${userId}`),
      );
    } catch (e) {
      console.error('Failed to check block status:', e);
      return { blocked: false };
    }
  }
}
