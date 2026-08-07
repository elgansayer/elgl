import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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

  async getItems(type: 'moment' | 'profile', status?: string): Promise<ModerationItem[]> {
    const params: Record<string, string> = { type };
    if (status) {
      params['status'] = status;
    }
    return firstValueFrom(
      this.http.get<ModerationItem[]>(`${this.baseUrl}/items`, {
        headers: this.getHeaders(),
        params,
      }),
    ).then((items) => items.map((item) => ({ ...item, type })));
  }

  async approveItem(itemId: string, type: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `${this.baseUrl}/approve`,
        { itemId, type },
        { headers: this.getHeaders() },
      ),
    );
  }

  async rejectItem(itemId: string, type: string, reason?: string): Promise<unknown> {
    const body: Record<string, string> = { itemId, type };
    if (reason) {
      body['reason'] = reason;
    }
    return firstValueFrom(
      this.http.post(
        `${this.baseUrl}/reject`,
        body,
        { headers: this.getHeaders() },
      ),
    );
  }

  async reportUser(reportedUserId: string, reasonCategory: string, description?: string): Promise<unknown> {
    const body: Record<string, string> = { reportedUserId, reasonCategory };
    if (description) {
      body['description'] = description;
    }
    return firstValueFrom(
      this.http.post(
        `${this.baseUrl}/report`,
        body,
        { headers: this.getHeaders() },
      ),
    );
  }

  async getUserRiskAnalysis(userId: string): Promise<UserAnalysisResult> {
    return firstValueFrom(
      this.http.get<UserAnalysisResult>(
        `${this.baseUrl}/analyse/${userId}`,
        { headers: this.getHeaders() },
      ),
    );
  }
}
