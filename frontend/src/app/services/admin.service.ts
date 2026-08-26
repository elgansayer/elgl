import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, catchError, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AdminUserSummary {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_languages: string[];
  target_languages: string[];
  is_vip: boolean;
  vip_tier: string;
  is_admin: boolean;
  coins_balance: number;
  study_streak_days: number;
  last_active_at?: string | null;
  created_at: string;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LoginHistoryEntry {
  id: string;
  user_id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AdminBlockEntry {
  id: string;
  blocker_id?: string;
  blocked_id?: string;
  blocker_name?: string | null;
  blocked_name?: string | null;
  blocker_avatar?: string | null;
  blocked_avatar?: string | null;
  created_at?: string;
  display_name?: string;
  native_language?: string;
  target_languages?: string[];
  avatar_url?: string;
}

export interface AdminBlocksListResult {
  blocks: AdminBlockEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const MOCK_ADMIN_USERS: AdminUserSummary[] = [
  {
    id: 'partner-1',
    display_name: 'Kenji',
    avatar_url: 'https://i.pravatar.cc/150?u=partner-1',
    native_languages: ['ja'],
    target_languages: ['en'],
    is_vip: false,
    vip_tier: 'free',
    is_admin: false,
    coins_balance: 100,
    study_streak_days: 4,
    last_active_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'partner-2',
    display_name: 'Maria',
    avatar_url: 'https://i.pravatar.cc/150?u=partner-2',
    native_languages: ['es'],
    target_languages: ['en'],
    is_vip: true,
    vip_tier: 'consumer_8_ukp_10_usd',
    is_admin: false,
    coins_balance: 320,
    study_streak_days: 20,
    last_active_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 'mock-user-123',
    display_name: 'Mock User',
    avatar_url: 'https://i.pravatar.cc/150?u=mock-user-123',
    native_languages: ['en'],
    target_languages: ['es', 'ja'],
    is_vip: true,
    vip_tier: 'premium',
    is_admin: true,
    coins_balance: 500,
    study_streak_days: 12,
    last_active_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
];

const MOCK_LOGIN_HISTORY: LoginHistoryEntry[] = [
  {
    id: 'login-1',
    user_id: 'partner-1',
    ip_address: '203.0.113.5',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'login-2',
    user_id: 'partner-1',
    ip_address: '203.0.113.5',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/admin`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  /**
   * Real backend check with no mock fallback, unlike listUsers()/getLoginHistory()
   * below. A non-admin must be told they lack access, not shown a fake page.
   */
  async checkAdminAccess(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get<AdminUserListResult>(`${this.baseUrl}/users`, {
          headers: this.getHeaders(),
          params: new HttpParams().set('page', '1').set('pageSize', '1'),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async listUsers(search: string, page: number, pageSize: number): Promise<AdminUserListResult> {
    let params = new HttpParams().set('page', page.toString()).set('pageSize', pageSize.toString());
    if (search) {
      params = params.set('search', search);
    }

    return firstValueFrom(
      this.http
        .get<AdminUserListResult>(`${this.baseUrl}/users`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 0) {
              return of({
                users: search
                  ? MOCK_ADMIN_USERS.filter((u) =>
                      (u.display_name ?? '').toLowerCase().includes(search.toLowerCase()),
                    )
                  : MOCK_ADMIN_USERS,
                total: MOCK_ADMIN_USERS.length,
                page,
                pageSize,
              });
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  async setVipStatus(userId: string, isVip: boolean, vipTier?: string): Promise<AdminUserSummary> {
    // This is a mutation, so HTTP failures (e.g. a 403 from AdminGuard) must
    // propagate to the caller rather than being masked by a fake success.
    return firstValueFrom(
      this.http.patch<AdminUserSummary>(
        `${this.baseUrl}/users/${userId}/vip`,
        { is_vip: isVip, vip_tier: vipTier },
        { headers: this.getHeaders() },
      ),
    );
  }

  async getLoginHistory(userId: string): Promise<LoginHistoryEntry[]> {
    return firstValueFrom(
      this.http
        .get<LoginHistoryEntry[]>(`${this.baseUrl}/users/${userId}/login-history`, {
          headers: this.getHeaders(),
        })
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 0) {
              return of(MOCK_LOGIN_HISTORY.filter((h) => h.user_id === userId));
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  async banUser(userId: string): Promise<{ message: string }> {
    return firstValueFrom(
      this.http.post<{ message: string }>(
        `${this.baseUrl}/users/${userId}/ban`,
        {},
        { headers: this.getHeaders() },
      ),
    );
  }

  async warnUser(userId: string): Promise<{ message: string }> {
    return firstValueFrom(
      this.http.post<{ message: string }>(
        `${this.baseUrl}/users/${userId}/warn`,
        {},
        { headers: this.getHeaders() },
      ),
    );
  }

  async listAllBlocks(page = 1, pageSize = 20): Promise<AdminBlocksListResult> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return firstValueFrom(
      this.http
        .get<AdminBlocksListResult>(`${this.baseUrl}/blocks`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(
          catchError((err: HttpErrorResponse) => {
            if (err.status === 0) {
              return of({ blocks: [], total: 0, page, pageSize });
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  async removeBlock(blockId: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.delete<{ success: boolean }>(`${this.baseUrl}/blocks/${blockId}`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async listBlockedUsers(): Promise<AdminBlockEntry[]> {
    const result = await this.listAllBlocks(1, 100);
    return result.blocks;
  }

  async adminUnblockUser(userId: string): Promise<{ success: boolean }> {
    const blocks = await this.listBlockedUsers();
    const block = blocks.find((b) => b.blocked_id === userId);
    if (!block) {
      throw new Error('Block not found');
    }
    return this.removeBlock(block.id);
  }
}

export type AdminBlockedUser = AdminBlockEntry;
