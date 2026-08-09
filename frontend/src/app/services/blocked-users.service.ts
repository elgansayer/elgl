import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export interface BlockedUserResponse {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_languages?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BlockedUsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl || '';

  private readonly blockedUsersSignal = signal<BlockedUserResponse[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly errorSignal = signal<string | null>(null);

  /** Read-only signal of the current blocked users list. */
  readonly blockedUsers = this.blockedUsersSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor() {
    this.loadBlockedUsers();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token') ?? '';
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  /** Fetches the full list of blocked user details from the backend and updates the signal. */
  async loadBlockedUsers(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const users: BlockedUserResponse[] = await firstValueFrom(
        this.http.get<BlockedUserResponse[]>(`${this.apiUrl}/blocks`, {
          headers: this.getHeaders(),
        })
      );
      this.blockedUsersSignal.set(users ?? []);
    } catch {
      this.blockedUsersSignal.set([]);
      this.errorSignal.set('Failed to load blocked users');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Unblock a user by ID and remove them from the local list optimistically. */
  async unblockUser(userId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/blocks/${userId}`, {
          headers: this.getHeaders(),
        })
      );
      this.blockedUsersSignal.update((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      // If the request fails, reload the full list to stay in sync.
      await this.loadBlockedUsers();
    }
  }
}
