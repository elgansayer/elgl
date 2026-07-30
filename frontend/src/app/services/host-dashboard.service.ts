import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HostDashboardStats {
  viewerCount: number;
  earnedCoins: number;
  startTime: Date;
}

@Injectable({ providedIn: 'root' })
export class HostDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/host-dashboard`;

  getDashboardStats(roomId: string): Observable<HostDashboardStats> {
    return this.http.get<HostDashboardStats>(`${this.apiUrl}/${roomId}/stats`);
  }
}
