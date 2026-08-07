import { inject, Injectable, resource, ResourceRef, Signal } from '@angular/core';
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

const FALLBACK_ITEMS: ModerationItem[] = [];

const FALLBACK_ANALYSIS: ModerationAnalysis = {
  riskScore: 0,
  flags: [],
};

const FALLBACK_FAILED_RESPONSE: ModerationActionResponse = {
  success: false,
  error: 'Service temporarily unavailable',
};

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);

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
      return await withRetry(() =>
        firstValueFrom(
          this.http.get<ModerationItem[]>(
            `${environment.apiUrl}/moderation/items`,
            { params },
          ),
        ),
      );
    } catch {
      return FALLBACK_ITEMS;
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
      return FALLBACK_ANALYSIS;
    }
  }
}
