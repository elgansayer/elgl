import { Injectable, inject, resource, ResourceRef, Signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { withRetry } from './http-retry';

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

export interface ModerationActionResponse {
  success: boolean;
  error?: string;
}

const FALLBACK_ITEMS: ModerationItem[] = [];

const FALLBACK_ANALYSIS: UserAnalysisResult = {
  riskScore: 0,
  flags: [],
};

const FALLBACK_FAILED_RESPONSE: ModerationActionResponse = {
  success: false,
  error: 'Service temporarily unavailable',
};

@Injectable({
  providedIn: 'root',
})
export class ModerationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/moderation`;

  getItemsResource(
    type: Signal<'moment' | 'profile'>,
  ): ResourceRef<ModerationItem[] | undefined> {
    return resource({
      params: () => ({ type: type() }),
      loader: ({ params }) => this.getItems(params.type),
    });
  }

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
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.get<ModerationItem[]>(`${this.baseUrl}/items`, {
            headers: this.getHeaders(),
            params,
          }),
        ).then((items) => items.map((item) => ({ ...item, type }))),
      );
    } catch {
      return FALLBACK_ITEMS;
    }
  }

  async approveItem(itemId: string, type: string): Promise<ModerationActionResponse> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${this.baseUrl}/approve`,
            { itemId, type },
            { headers: this.getHeaders() },
          ),
        ),
      );
    } catch {
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async rejectItem(itemId: string, type: string, reason?: string): Promise<ModerationActionResponse> {
    const body: Record<string, string> = { itemId, type };
    if (reason) {
      body['reason'] = reason;
    }
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${this.baseUrl}/reject`,
            body,
            { headers: this.getHeaders() },
          ),
        ),
      );
    } catch {
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async reportUser(
    reportedUserId: string,
    reasonCategory: string,
    description?: string,
  ): Promise<ModerationActionResponse> {
    const body: Record<string, string> = { reportedUserId, reasonCategory };
    if (description) {
      body['description'] = description;
    }
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${this.baseUrl}/report`,
            body,
            { headers: this.getHeaders() },
          ),
        ),
      );
    } catch {
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async getUserRiskAnalysis(userId: string): Promise<UserAnalysisResult> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.get<UserAnalysisResult>(`${this.baseUrl}/analyse/${userId}`, {
            headers: this.getHeaders(),
          }),
        ),
      );
    } catch {
      return FALLBACK_ANALYSIS;
    }
  }
}
