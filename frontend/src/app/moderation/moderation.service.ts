import { inject, Injectable, resource, ResourceRef, Signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ModerationItem {
  id: string;
  type: 'moment' | 'profile';
  status: string;
  created_at: string;
  reason: string;
  description?: string;
  reporter: { id: string; display_name: string } | null;
  reported_user: { id: string; display_name: string } | null;
  moment_content?: string;
  momentAuthorName?: string | null;
}

export interface ModerationAnalysis {
  riskScore: number;
  flags: string[];
}

export interface ModerationActionResponse {
  success: boolean;
}

export interface UserAnalysisResult {
  riskScore: number;
  flags: string[];
}

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);

  getItemsResource(
    type: Signal<'moment' | 'profile'>,
  ): ResourceRef<ModerationItem[] | undefined> {
    return resource({
      params: () => ({ type: type() }),
      loader: ({ params }) => firstValueFrom(this.getItems(params.type)),
    });
  }

  getItems(type: 'moment' | 'profile', status?: string) {
    let params = new HttpParams().set('type', type);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ModerationItem[]>(
      `${environment.apiUrl}/moderation/items`,
      { params },
    );
  }

  reportUser(reportedUserId: string, reasonCategory: string, description?: string) {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/moderation/report`,
      { reportedUserId, reasonCategory, description },
    );
  }

  approveItem(itemId: string, type: 'moment' | 'profile') {
    return this.http.post<ModerationActionResponse>(
      `${environment.apiUrl}/moderation/approve`,
      { itemId, type },
    );
  }

  rejectItem(itemId: string, type: 'moment' | 'profile', reason?: string) {
    return this.http.post<ModerationActionResponse>(
      `${environment.apiUrl}/moderation/reject`,
      { itemId, type, reason },
    );
  }

  analyseUser(userId: string) {
    return this.http.get<ModerationAnalysis>(
      `${environment.apiUrl}/moderation/analyse/${userId}`,
    );
  }

  /** Alias for analyseUser - used by components that import the older API shape. */
  getUserRiskAnalysis(userId: string) {
    return this.http.get<UserAnalysisResult>(
      `${environment.apiUrl}/moderation/analyse/${userId}`,
    );
  }
}
