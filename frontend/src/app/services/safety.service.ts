import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root',
})
export class SafetyService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // Local cache for blocked user IDs (bidirectional: blocked + blocker)
  private _blockedUserIds = signal<Set<string>>(new Set());
  public readonly blockedUserIdsSignal = this._blockedUserIds.asReadonly();

  private blockedIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  public blockedUserIds$ = this.blockedIdsSubject.asObservable();

  // Public read-only accessor (could be used for reactivity)
  get blockedUserIds(): ReadonlySet<string> {
    return this._blockedUserIds();
  }

  /**
   * Load the initial list of blocked user IDs from the backend.
   * Should be called once after user login / app init.
   */
  async loadBlockedUsers(): Promise<void> {
    try {
      const ids = await lastValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`),
      );
      const newSet = new Set(ids);
      this._blockedUserIds.set(newSet);
      this.blockedIdsSubject.next(newSet);
    } catch (e) {
      console.error('Failed to load blocked user IDs', e);
    }
  }

  /** Synchronous cache-based check (fast, no network) */
  isUserBlockedCached(userId: string): boolean {
    return this._blockedUserIds().has(userId);
  }

  reportUser(dto: ReportUserDto): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.apiUrl}/safety/report`, dto);
  }

  /** Promise-based version for use with async/await in components */
  async reportUserAsync(dto: ReportUserDto): Promise<ReportResponse> {
    return lastValueFrom(this.reportUser(dto));
  }

  blockUser(
    blockedId: string,
  ): Observable<{ success: boolean; blocked_id: string }> {
    return this.http.post<{ success: boolean; blocked_id: string }>(
      `${this.apiUrl}/safety/block/${blockedId}`,
      {},
    );
  }

  /** Promise-based version that also updates the local cache */
  async blockUserAsync(
    blockedId: string,
  ): Promise<{ success: boolean; blocked_id: string }> {
    const res = await lastValueFrom(this.blockUser(blockedId));
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.add(blockedId);
      return next;
    });
    this.blockedIdsSubject.next(this._blockedUserIds());
    return res;
  }

  unblockUser(blockedId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/safety/unblock/${blockedId}`,
      {},
    );
  }

  /** Promise-based version that also updates the local cache */
  async unblockUserAsync(blockedId: string): Promise<{ success: boolean }> {
    const res = await lastValueFrom(this.unblockUser(blockedId));
    this._blockedUserIds.update((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
    this.blockedIdsSubject.next(this._blockedUserIds());
    return res;
  }

  getBlockedIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`);
  }

  /** Promise-based version for use with async/await in components */
  async getBlockedIdsAsync(): Promise<string[]> {
    return lastValueFrom(this.getBlockedIds());
  }

  /** Returns report categories from the backend.
   *  The response must be localised using the Accept-Language header. */
  getReportCategories(): Observable<ReportCategory[]> {
    return this.http.get<ReportCategory[]>(`${this.apiUrl}/safety/report-categories`).pipe(
      catchError(() => {
        // Fall back to static list if the API fails (e.g., network issue)
        return of(this.getStaticReportCategories());
      })
    );
  }

  /** Alias for getReportCategories used by the report modal */
  getCategories(): Observable<ReportCategory[]> {
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
      return lastValueFrom(
        this.http.get<string[]>(
          `${this.apiUrl}/safety/blocked-ids/${userId}`,
        ),
      );
    } catch (e) {
      console.error('Failed to get blocked user IDs:', e);
      return [];
    }
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    try {
      return lastValueFrom(
        this.http.get<string[]>(
          `${this.apiUrl}/safety/blocker-ids/${userId}`,
        ),
      );
    } catch (e) {
      console.error('Failed to get blocker user IDs:', e);
      return [];
    }
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    try {
      return lastValueFrom(
        this.http.get<string[]>(
          `${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`,
        ),
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
      return lastValueFrom(
        this.http.get<{ blocked: boolean }>(
          `${this.apiUrl}/safety/is-blocked/${userId}`,
        ),
      );
    } catch (e) {
      console.error('Failed to check block status:', e);
      return { blocked: false };
    }
  }
}
