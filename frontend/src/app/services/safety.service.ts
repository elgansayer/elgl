import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  blockUser(blockedId: string): Observable<{ success: boolean; blocked_id: string }> {
    return this.http.post<{ success: boolean; blocked_id: string }>(`${this.apiUrl}/safety/block`, { blocked_id: blockedId });
  }

  getBlockedIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/safety/blocked-ids`);
  }

  /** Returns a static list of report categories.
   *  In a production app this could be fetched from the backend. */
  getReportCategories(): ReportCategory[] {
    return [
      { value: 'spam', label: 'Spam' },
      { value: 'harassment', label: 'Harassment' },
      { value: 'inappropriate_content', label: 'Inappropriate Content' },
      { value: 'fake_profile', label: 'Fake Profile' },
      { value: 'other', label: 'Other' },
    ];
  }
}
