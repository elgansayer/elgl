import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export interface HostDashboardStats {
  viewerCount: number;
  earnedCoins: number;
  startTime: Date;
}

interface HostDashboardApiStats {
  roomId: string;
  viewerCount: number;
  earnedCoins: number;
  startTime: string;
}

@Injectable({ providedIn: 'root' })
export class HostDashboardService {
  private readonly api = inject(ApiService);

  async getDashboardStats(roomId: string): Promise<HostDashboardStats> {
    const fallback: HostDashboardApiStats = {
      roomId,
      viewerCount: 0,
      earnedCoins: 0,
      startTime: new Date().toISOString(),
    };

    try {
      const stats = await this.api.get<HostDashboardApiStats>(
        `${environment.apiUrl}/host-dashboard/${encodeURIComponent(roomId)}/stats`,
        { fallback },
      );
      return {
        viewerCount: stats.viewerCount,
        earnedCoins: stats.earnedCoins,
        startTime: new Date(stats.startTime),
      };
    } catch {
      return {
        viewerCount: fallback.viewerCount,
        earnedCoins: fallback.earnedCoins,
        startTime: new Date(fallback.startTime),
      };
    }
  }
}
