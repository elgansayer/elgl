import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StudyBuddyMatch {
  id: string;
  display_name: string;
  avatar_url?: string;
}

export type BuddyRequestStatus = 'pending' | 'accepted' | 'declined';

export interface BuddyRequester {
  id: string;
  display_name?: string;
  avatar_url?: string;
}

export interface BuddyRequest {
  id: string;
  requesterId: string;
  partnerId: string;
  message?: string | null;
  status: BuddyRequestStatus;
  createdAt: string;
  requester?: BuddyRequester;
}

@Injectable({ providedIn: 'root' })
export class StudyBuddyService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  async requestBuddy(dto: { partnerId: string; message?: string }): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiUrl}/study-buddies/request`, dto));
  }

  async getMatches(): Promise<StudyBuddyMatch[]> {
    try {
      const data = await firstValueFrom(
        this.http.get<Record<string, unknown>[]>(`${this.apiUrl}/study-buddies/matches`),
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

  getIncomingRequests(): Promise<BuddyRequest[]> {
    return firstValueFrom(this.http.get<BuddyRequest[]>(`${this.apiUrl}/study-buddies/requests`));
  }

  async acceptRequest(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiUrl}/study-buddies/requests/${id}/accept`, {}));
  }

  async declineRequest(id: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiUrl}/study-buddies/requests/${id}/decline`, {}));
  }
}
