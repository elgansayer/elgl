import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface UserStats {
  translations_count: number;
  corrections_count: number;
  messages_count: number;
  moments_count: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private api = inject(ApiService);

  async getMyStats(): Promise<UserStats> {
    return this.api.get<UserStats>('/stats/me');
  }
}