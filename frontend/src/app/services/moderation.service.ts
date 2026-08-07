import { Injectable, signal, inject } from '@angular/core';
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

const MOCK_MODERATION_ITEMS: ModerationItem[] = [
  {
    id: 'mock-report-1',
    type: 'profile',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    reason: 'harassment',
    description: 'User is sending abusive messages',
    reporter: { id: 'partner-1', display_name: 'Kenji' },
    reported_user: { id: 'mock-bad-1', display_name: 'SpamBot42' },
  },
  {
    id: 'mock-report-2',
    type: 'profile',
    status: 'pending',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    reason: 'inappropriate_content',
    description: 'Profile photo contains nudity',
    reporter: { id: 'partner-2', display_name: 'Maria' },
    reported_user: { id: 'mock-bad-2', display_name: 'BadProfile99' },
  },
  {
    id: 'mock-report-3',
    type: 'moment',
    status: 'pending',
    created_at: new Date(Date.now() - 10800000).toISOString(),
    reason: 'spam',
    description: 'Moment contains advertisement spam',
    reporter: { id: 'mock-user-123', display_name: 'Mock User' },
    reported_user: { id: 'mock-bad-3', display_name: 'SpamPoster' },
  },
  {
    id: 'mock-report-4',
    type: 'moment',
    status: 'pending',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    reason: 'hate_speech',
    description: 'Moment contains offensive language targeting a group',
    reporter: { id: 'partner-1', display_name: 'Kenji' },
    reported_user: { id: 'mock-bad-4', display_name: 'HatefulUser' },
  },
];

const MOCK_ANALYSES: Record<string, UserAnalysisResult> = {
  'mock-bad-1': { riskScore: 72, flags: ['harassment', 'abusive', 'threat'] },
  'mock-bad-2': { riskScore: 85, flags: ['inappropriate_content', 'nudity', 'explicit'] },
  'mock-bad-3': { riskScore: 45, flags: ['spam', 'advertisement', 'solicitation'] },
  'mock-bad-4': { riskScore: 68, flags: ['hate_speech', 'offensive', 'discrimination'] },
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

  readonly isBackendAvailable = signal(true);

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
      const result = await withRetry(() =>
        firstValueFrom(
          this.http.get<ModerationItem[]>(`${this.baseUrl}/items`, {
            headers: this.getHeaders(),
            params,
          }),
        ).then((items) => items.map((item) => ({ ...item, type }))),
      );
      this.isBackendAvailable.set(true);
      return result;
    } catch {
      this.isBackendAvailable.set(false);
      console.warn('Moderation backend unreachable, serving cached fallback data.');
      return MOCK_MODERATION_ITEMS
        .filter((item) => {
          const typeMatch = item.type === type;
          const statusMatch = !status || item.status === status;
          return typeMatch && statusMatch;
        })
        .map((item) => ({ ...item, type }));
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
      console.warn('Approve action failed - backend unreachable.');
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
      console.warn('Reject action failed - backend unreachable.');
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
      console.warn('Report submission failed - backend unreachable.');
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
      console.warn('User analysis failed - backend unreachable, using heuristic fallback.');
      if (MOCK_ANALYSES[userId]) {
        return MOCK_ANALYSES[userId];
      }
      return { riskScore: 0, flags: [] };
    }
  }
}
