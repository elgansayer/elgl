import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminUserSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  native_languages: string[] | null;
  target_languages: string[] | null;
  is_vip: boolean | null;
  vip_tier: string | null;
  is_admin: boolean | null;
  coins_balance: number | null;
  study_streak_days: number | null;
  last_active_at: string | null;
  created_at: string | null;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserSearchQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AdminLoginHistoryEntry {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  search(query: AdminUserSearchQuery): Observable<AdminUserListResult> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));
    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminUserListResult>(`${apiBaseUrl}/admin/v1/users`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          params,
        }),
      ),
    );
  }

  getUser(userId: string): Observable<AdminUserSummary> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminUserSummary>(
          `${apiBaseUrl}/admin/v1/users/${encodeURIComponent(userId)}`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        ),
      ),
    );
  }

  getLoginHistory(userId: string): Observable<AdminLoginHistoryEntry[]> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminLoginHistoryEntry[]>(
          `${apiBaseUrl}/admin/v1/users/${encodeURIComponent(userId)}/login-history`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        ),
      ),
    );
  }
}
