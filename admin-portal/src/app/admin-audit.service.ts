import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminAuditEventSummary {
  id: string;
  actor_user_id: string;
  action: string;
  capability_key: string | null;
  target_type: string | null;
  target_id: string | null;
  reason_code: string | null;
  outcome: 'success' | 'denied' | 'failed';
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminAuditListResult {
  events: AdminAuditEventSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAuditQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  outcome?: 'success' | 'denied' | 'failed';
  capabilityKey?: string;
  reasonCode?: string;
  actorUserId?: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  startTime?: string;
  endTime?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  list(query: AdminAuditQuery): Observable<AdminAuditListResult> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 50));
    for (const [key, value] of Object.entries(query)) {
      if (key === 'page' || key === 'pageSize') continue;
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (normalized) params = params.set(key, normalized);
    }

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminAuditListResult>(`${apiBaseUrl}/admin/v1/audit`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          params,
        }),
      ),
    );
  }
}
