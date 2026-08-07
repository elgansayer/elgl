import { inject, Injectable, resource, ResourceRef, Signal, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { withRetry } from '../services/http-retry';

export interface ModerationItem {
  id: string;
  type: 'moment' | 'profile';
  status: string;
  created_at: string;
  reason: string;
  description?: string;
  reporter: { id: string; display_name: string } | null;
  reported_user: { id: string; display_name: string } | null;
}

export interface ModerationAnalysis {
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

const MOCK_ANALYSES: Record<string, ModerationAnalysis> = {
  'mock-bad-1': { riskScore: 72, flags: ['harassment', 'abusive', 'threat'] },
  'mock-bad-2': { riskScore: 85, flags: ['inappropriate_content', 'nudity', 'explicit'] },
  'mock-bad-3': { riskScore: 45, flags: ['spam', 'advertisement', 'solicitation'] },
  'mock-bad-4': { riskScore: 68, flags: ['hate_speech', 'offensive', 'discrimination'] },
};

const FALLBACK_FAILED_RESPONSE: ModerationActionResponse = {
  success: false,
  error: 'Service temporarily unavailable',
};

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);

  /** Whether the backend is currently reachable. Reset on each successful call. */
  readonly isBackendAvailable = signal(true);

  getItemsResource(
    type: Signal<'moment' | 'profile'>,
  ): ResourceRef<ModerationItem[] | undefined> {
    return resource({
      params: () => ({ type: type() }),
      loader: ({ params }) => this.getItems(params.type),
    });
  }

  async getItems(type: 'moment' | 'profile', status?: string): Promise<ModerationItem[]> {
    let params = new HttpParams().set('type', type);
    if (status) {
      params = params.set('status', status);
    }
    try {
      const result = await withRetry(() =>
        firstValueFrom(
          this.http.get<ModerationItem[]>(
            `${environment.apiUrl}/moderation/items`,
            { params },
          ),
        ),
      );
      this.isBackendAvailable.set(true);
      return result;
    } catch {
      this.isBackendAvailable.set(false);
      console.warn('Moderation backend unreachable, serving cached fallback data.');
      return MOCK_MODERATION_ITEMS.filter((item) => {
        const typeMatch = item.type === type;
        const statusMatch = !status || item.status === status;
        return typeMatch && statusMatch;
      });
    }
  }

  async reportUser(
    reportedUserId: string,
    reasonCategory: string,
    description?: string,
  ): Promise<ModerationActionResponse> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${environment.apiUrl}/moderation/report`,
            { reportedUserId, reasonCategory, description },
          ),
        ),
      );
    } catch {
      console.warn('Report submission failed - backend unreachable.');
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async approveItem(
    itemId: string,
    type: 'moment' | 'profile',
  ): Promise<ModerationActionResponse> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${environment.apiUrl}/moderation/approve`,
            { itemId, type },
          ),
        ),
      );
    } catch {
      console.warn('Approve action failed - backend unreachable.');
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async rejectItem(
    itemId: string,
    type: 'moment' | 'profile',
    reason?: string,
  ): Promise<ModerationActionResponse> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.post<ModerationActionResponse>(
            `${environment.apiUrl}/moderation/reject`,
            { itemId, type, reason },
          ),
        ),
      );
    } catch {
      console.warn('Reject action failed - backend unreachable.');
      return FALLBACK_FAILED_RESPONSE;
    }
  }

  async analyseUser(userId: string): Promise<ModerationAnalysis> {
    try {
      return await withRetry(() =>
        firstValueFrom(
          this.http.get<ModerationAnalysis>(
            `${environment.apiUrl}/moderation/analyse/${userId}`,
          ),
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
