import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ModerationItem {
  id: string;
  type: 'moment' | 'profile';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reason: string;
  reporter: {
    id: string;
    name?: string;
    display_name?: string;
  };
  reported_user?: {
    id: string;
    name?: string;
    display_name?: string;
  };
  moment_content?: string;
  reportedMomentId?: string | null;
  momentAuthorName?: string;
  description?: string;
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

  getItems(type: 'moment' | 'profile', status?: string): Observable<ModerationItem[]> {
    const params: Record<string, string> = { type };
    if (status) {
      params['status'] = status;
    }
    return this.http.get<ModerationItem[]>(`${this.baseUrl}/items`, {
      headers: this.getHeaders(),
      params,
    }).pipe(
      map(items => items.map(item => ({ ...item, type }))),
    );
  }

  approveItem(itemId: string, type: string): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}/approve`,
      { itemId, type },
      { headers: this.getHeaders() },
    );
  }

  rejectItem(itemId: string, type: string, reason?: string): Observable<unknown> {
    const body: Record<string, string> = { itemId, type };
    if (reason) {
      body['reason'] = reason;
    }
    return this.http.post(
      `${this.baseUrl}/reject`,
      body,
      { headers: this.getHeaders() },
    );
  }

  reportUser(reportedUserId: string, reasonCategory: string, description?: string): Observable<unknown> {
    const body: Record<string, string> = { reportedUserId, reasonCategory };
    if (description) {
      body['description'] = description;
    }
    return this.http.post(
      `${this.baseUrl}/report`,
      body,
      { headers: this.getHeaders() },
    );
  }

  getUserRiskAnalysis(userId: string): Observable<UserAnalysisResult> {
    return this.http.get<UserAnalysisResult>(
      `${this.baseUrl}/analyse/${userId}`,
      { headers: this.getHeaders() },
    );
  }
}
