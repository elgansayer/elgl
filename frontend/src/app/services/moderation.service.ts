import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ModerationItem {
  id: string;
  type: 'moment' | 'profile';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reason: string;
  reporter: {
    id: string;
    name: string;
  };
  reported_user?: {
    id: string;
    name: string;
  };
  moment_content?: string;
}

export interface UserAnalysisResult {
  riskScore: number;
  flags: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ModerationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/moderation`;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token') ?? '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getItems(type: 'moment' | 'profile', status?: string): Promise<ModerationItem[]> {
    const params: Record<string, string> = { type };
    if (status) {
      params['status'] = status;
    }
    return firstValueFrom(
      this.http
        .get<ModerationItem[]>(`${this.baseUrl}/items`, {
          headers: this.getHeaders(),
          params,
        })
        .pipe(catchError(() => of([]))),
    );
  }

  approveItem(itemId: string, type: string): Promise<unknown> {
    return firstValueFrom(
      this.http
        .post(
          `${this.baseUrl}/approve`,
          { itemId, type },
          {
            headers: this.getHeaders(),
          },
        )
        .pipe(catchError(() => of(null))),
    );
  }

  rejectItem(itemId: string, type: string, reason?: string): Promise<unknown> {
    return firstValueFrom(
      this.http
        .post(
          `${this.baseUrl}/reject`,
          { itemId, type, reason },
          {
            headers: this.getHeaders(),
          },
        )
        .pipe(catchError(() => of(null))),
    );
  }

  reportUser(reportedUserId: string, reason: string, description?: string): Promise<unknown> {
    return firstValueFrom(
      this.http
        .post(
          `${this.baseUrl}/report`,
          { reportedUserId, reason, description },
          { headers: this.getHeaders() },
        )
        .pipe(catchError(() => of(null))),
    );
  }

  getUserRiskAnalysis(userId: string): Promise<UserAnalysisResult> {
    return firstValueFrom(
      this.http
        .get<UserAnalysisResult>(`${this.baseUrl}/analyse/${userId}`, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of({ riskScore: 0, flags: [] }))),
    );
  }
}
