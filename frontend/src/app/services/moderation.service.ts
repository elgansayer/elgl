import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ModerationItem {
  id: string;
  type: 'moment' | 'profile';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reason: string;
  reporter: {
    id: string;
    name: string;
  };
  reported_user?: {
    id: string;
    name: string;
  };
  moment_content?: string;
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
    return this.http
      .get<ModerationItem[]>(`${this.baseUrl}/items`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(() => of([])));
  }

  approveItem(itemId: string, type: string): Observable<unknown> {
    return this.http
      .post(
        `${this.baseUrl}/approve`,
        { itemId, type },
        {
          headers: this.getHeaders(),
        },
      )
      .pipe(catchError(() => of(null)));
  }

  rejectItem(itemId: string, type: string, reason?: string): Observable<unknown> {
    return this.http
      .post(
        `${this.baseUrl}/reject`,
        { itemId, type, reason },
        {
          headers: this.getHeaders(),
        },
      )
      .pipe(catchError(() => of(null)));
  }
}
