import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface BlockedUserResponse {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_language?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BlockedUsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl || '';

  private readonly blockedUsersSignal = signal<BlockedUserResponse[]>([]);

  /** Read-only signal of the current blocked users list. */
  readonly blockedUsers = this.blockedUsersSignal.asReadonly();

  constructor() {
    this.loadBlockedUsers();
  }

  /** Fetches the full list of blocked user details from the backend and updates the signal. */
  async loadBlockedUsers(): Promise<void> {
    try {
      const users = await firstValueFrom(
        this.http.get<BlockedUserResponse[]>(`${this.apiUrl}/safety/blocked-users-details`)
      );
      this.blockedUsersSignal.set(users ?? []);
    } catch {
      this.blockedUsersSignal.set([]);
    }
  }

  /** Unblock a user by ID and remove them from the local list optimistically. */
  async unblockUser(userId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/safety/unblock`, { blocked_id: userId })
      );
      this.blockedUsersSignal.update(prev => prev.filter(u => u.id !== userId));
    } catch {
      // If the request fails, reload the full list to stay in sync.
      await this.loadBlockedUsers();
    }
  }
}
