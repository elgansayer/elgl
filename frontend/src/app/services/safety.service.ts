import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportUserDto {
  reported_id: string;
  reason_category: string;
  description?: string;
  context_url?: string;
}

export interface ReportResponse {
  success: boolean;
  message: string;
}

export interface ReportCategory {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class SafetyService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  reportUser(dto: ReportUserDto): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.apiUrl}/safety/report`, dto);
  }

  /** Promise-based version for use with async/await in components */
  async reportUserAsync(dto: ReportUserDto): Promise<ReportResponse> {
    return lastValueFrom(this.reportUser(dto));
  }

  blockUser(blockedId: string): Observable<{ success: boolean; blocked_id: string }> {
    return this.http.post<{ success: boolean; blocked_id: string }>(`${this.apiUrl}/safety/block/${blockedId}`, {});
  }

  /** Promise-based version for use with async/await in components */
  async blockUserAsync(blockedId: string): Promise<{ success: boolean; blocked_id: string }> {
    return lastValueFrom(this.blockUser(blockedId));
  }

  unblockUser(blockedId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/safety/unblock`, { blocked_id: blockedId });
  }

  /** Promise-based version for use with async/await in components */
  async unblockUserAsync(blockedId: string): Promise<{ success: boolean }> {
    return lastValueFrom(this.unblockUser(blockedId));
  }

  getBlockedIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`);
  }

  /** Promise-based version for use with async/await in components */
  async getBlockedIdsAsync(): Promise<string[]> {
    return lastValueFrom(this.getBlockedIds());
  }

  /** Returns a static list of report categories.
   *  In a production app this could be fetched from the backend. */
  getReportCategories(): ReportCategory[] {
    return [
      { value: 'harassment', label: 'Harassment' },
      { value: 'spam', label: 'Spam' },
      { value: 'inappropriate_content', label: 'Inappropriate Content' },
      { value: 'fake_profile', label: 'Fake Profile' },
      { value: 'other', label: 'Other' },
    ];
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    try {
      return lastValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids/${userId}`)
      );
    } catch (e) {
      console.error('Failed to get blocked user IDs:', e);
      return [];
    }
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    try {
      return lastValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocker-ids/${userId}`)
      );
    } catch (e) {
      console.error('Failed to get blocker user IDs:', e);
      return [];
    }
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    try {
      return lastValueFrom(
        this.http.get<string[]>(`${this.apiUrl}/safety/blocked-and-blocker-ids/${userId}`)
      );
    } catch (e) {
      console.error('Failed to get blocked and blocker IDs:', e);
      return [];
    }
  }

  async isBlocked(userId: string): Promise<{ blocked: boolean }> {
    try {
      return lastValueFrom(
        this.http.get<{ blocked: boolean }>(`${this.apiUrl}/safety/is-blocked/${userId}`)
      );
    } catch (e) {
      console.error('Failed to check block status:', e);
      return { blocked: false };
    }
  }
}
