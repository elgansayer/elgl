import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StudyBuddyService {
  private http = inject(HttpClient);

  async requestBuddy(dto: { partnerId: string; message?: string }) {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/study-buddies/request`, dto),
      );
    } catch {
      console.warn('Study buddy request failed (fallback)');
    }
  }

  async getMatches(): Promise<Record<string, unknown>[]> {
    try {
      const data = await firstValueFrom(
        this.http.get<Record<string, unknown>[]>(`${environment.apiUrl}/study-buddies/matches`),
      );
      return data ?? [];
    } catch {
      return [];
    }
  }
}
