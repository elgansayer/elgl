import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StudyBuddyMatch {
  id: string;
  display_name: string;
  avatar_url?: string;
}

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

  async getMatches(): Promise<StudyBuddyMatch[]> {
    try {
      const data = await firstValueFrom(
        this.http.get<Record<string, unknown>[]>(`${environment.apiUrl}/study-buddies/matches`),
      );
      if (!data) return [];
      const matches: StudyBuddyMatch[] = data
        .filter(item => typeof item === 'object' && item !== null && 'id' in item && 'display_name' in item)
        .map(item => ({
          id: String(item['id']),
          display_name: String(item['display_name']),
          avatar_url: typeof item['avatar_url'] === 'string' ? item['avatar_url'] : undefined,
        }));
      return matches;
    } catch {
      return [];
    }
  }
}
