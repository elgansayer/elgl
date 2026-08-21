import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminOperationalEvent {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  correlation_id: string | null;
  source: string | null;
  created_at: string;
}

export interface AdminOperationalEventsResult {
  events: AdminOperationalEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOperationalEventsQuery {
  page?: number;
  pageSize?: number;
  severity?: string;
  category?: string;
  source?: string;
  correlationId?: string;
  startTime?: string;
  endTime?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminOperationalEventsService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  list(query: AdminOperationalEventsQuery): Observable<AdminOperationalEventsResult> {
    const token = this.login.accessToken();
    if (!token) return throwError(() => new Error('Admin authentication required'));

    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 25));
    if (query.severity) params = params.set('severity', query.severity);
    if (query.category?.trim()) params = params.set('category', query.category.trim());
    if (query.source?.trim()) params = params.set('source', query.source.trim());
    if (query.correlationId?.trim()) params = params.set('correlationId', query.correlationId.trim());
    if (query.startTime) params = params.set('startTime', query.startTime);
    if (query.endTime) params = params.set('endTime', query.endTime);

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminOperationalEventsResult>(`${apiBaseUrl}/admin/v1/logs`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          params,
        }),
      ),
    );
  }
}
