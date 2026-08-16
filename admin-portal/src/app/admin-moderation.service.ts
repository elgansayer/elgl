import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export interface AdminModerationReport {
  id: string;
  reporter_id: string | null;
  reported_user_id: string;
  reason_category: string;
  description: string | null;
  status: string;
  reported_name?: string | null;
  reporter_name?: string | null;
  created_at: string;
}

export interface AdminModerationReportList {
  reports: AdminModerationReport[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  listReports(
    page: number,
    pageSize: number,
    reportId?: string,
    status?: string,
    reasonCategory?: string,
    reportedUserId?: string,
    reporterUserId?: string,
    startTime?: string,
    endTime?: string,
  ): Observable<AdminModerationReportList> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new Error('Admin authentication required'));
    }

    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    const normalizedReportId = reportId?.trim();
    const normalizedStatus = status?.trim();
    const normalizedReasonCategory = reasonCategory?.trim();
    const normalizedReportedUserId = reportedUserId?.trim();
    const normalizedReporterUserId = reporterUserId?.trim();
    if (normalizedReportId) params = params.set('reportId', normalizedReportId);
    if (normalizedStatus) params = params.set('status', normalizedStatus);
    if (normalizedReasonCategory) {
      params = params.set('reasonCategory', normalizedReasonCategory);
    }
    if (normalizedReportedUserId) {
      params = params.set('reportedUserId', normalizedReportedUserId);
    }
    if (normalizedReporterUserId) {
      params = params.set('reporterUserId', normalizedReporterUserId);
    }
    if (startTime) params = params.set('startTime', startTime);
    if (endTime) params = params.set('endTime', endTime);

    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) =>
        this.http.get<AdminModerationReportList>(
          `${apiBaseUrl}/admin/v1/moderation/reports`,
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            params,
          },
        ),
      ),
    );
  }
}
