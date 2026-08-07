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
}

export interface ModerationAnalysis {
  riskScore: number;
  flags: string[];
}

export interface ModerationActionResponse {
  success: boolean;
}

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
    return firstValueFrom(
      this.http.get<ModerationItem[]>(
        `${environment.apiUrl}/moderation/items`,
        { params },
      ),
    );
  }

  async reportUser(reportedUserId: string, reasonCategory: string, description?: string): Promise<{ success: boolean }> {
    return firstValueFrom(
      this.http.post<{ success: boolean }>(
        `${environment.apiUrl}/moderation/report`,
        { reportedUserId, reasonCategory, description },
      ),
    );
  }

  async approveItem(itemId: string, type: 'moment' | 'profile'): Promise<ModerationActionResponse> {
    return firstValueFrom(
      this.http.post<ModerationActionResponse>(
        `${environment.apiUrl}/moderation/approve`,
        { itemId, type },
      ),
    );
  }

  async rejectItem(itemId: string, type: 'moment' | 'profile', reason?: string): Promise<ModerationActionResponse> {
    return firstValueFrom(
      this.http.post<ModerationActionResponse>(
        `${environment.apiUrl}/moderation/reject`,
        { itemId, type, reason },
      ),
    );
  }

  async analyseUser(userId: string): Promise<ModerationAnalysis> {
    return firstValueFrom(
      this.http.get<ModerationAnalysis>(
        `${environment.apiUrl}/moderation/analyse/${userId}`,
      ),
    );
  }
}
