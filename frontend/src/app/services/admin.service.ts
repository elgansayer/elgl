import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
   * Real backend check with no mock fallback. A non-admin or an unavailable
   * authorization boundary must never be represented as a successful admin
   * session.
   */
  async checkAdminAccess(): Promise<boolean> {
    const token = this.authService.getAccessToken();
    if (!token) {
      return false;
    }

    try {
      await firstValueFrom(
        this.http.get<AdminUserListResult>(`${this.baseUrl}/users`, {
          headers: { Authorization: `Bearer ${token}` },
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
      this.http.get<AdminUserListResult>(`${this.baseUrl}/users`, {
        headers: this.getHeaders(),
        params,
      }),
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
      this.http.get<LoginHistoryEntry[]>(`${this.baseUrl}/users/${userId}/login-history`, {
        headers: this.getHeaders(),
      }),
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
      this.http.get<AdminBlocksListResult>(`${this.baseUrl}/blocks`, {
        headers: this.getHeaders(),
        params,
      }),
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
