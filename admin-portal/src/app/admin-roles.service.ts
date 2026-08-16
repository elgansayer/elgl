import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminRoleInventoryEntry {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  capabilities: string[];
}

export interface AdminRoleAssignmentSummary {
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
  active: boolean;
}

export interface AdminRoleAssignmentsListResult {
  assignments: AdminRoleAssignmentSummary[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  list(): Observable<AdminRoleInventoryEntry[]> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminRoleInventoryEntry[]>(`${apiBaseUrl}/admin/v1/roles`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        }),
      ),
    );
  }

  listAssignments(
    page: number,
    pageSize: number,
    userId?: string,
    roleKey?: string,
    grantedBy?: string,
    startTime?: string,
    endTime?: string,
  ): Observable<AdminRoleAssignmentsListResult> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    if (userId?.trim()) params = params.set('userId', userId.trim());
    if (roleKey?.trim()) params = params.set('roleKey', roleKey.trim());
    if (grantedBy?.trim()) params = params.set('grantedBy', grantedBy.trim());
    if (startTime) params = params.set('startTime', startTime);
    if (endTime) params = params.set('endTime', endTime);

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminRoleAssignmentsListResult>(
          `${apiBaseUrl}/admin/v1/roles/assignments`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            params,
          },
        ),
      ),
    );
  }
}
