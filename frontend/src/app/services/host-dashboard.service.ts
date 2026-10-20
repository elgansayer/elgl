import { Injectable } from '@angular/core';

export interface HostDashboardStats {
  viewerCount: number;
  earnedCoins: number;
  startTime: Date;
}

@Injectable({ providedIn: 'root' })
export class HostDashboardService {
  getDashboardStats(_roomId: string): Promise<HostDashboardStats> {
    const dummy = {
      viewerCount: Math.floor(Math.random() * 50) + 5,
      earnedCoins: Math.floor(Math.random() * 20) + 1,
      startTime: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
    };
    return Promise.resolve(dummy);
  }
}
