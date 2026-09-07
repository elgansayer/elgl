import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

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
  private readonly authService = inject(AuthService);
  private readonly apiUrl = environment.apiUrl || '';

  private readonly blockedUsersSignal = signal<BlockedUserResponse[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly errorSignal = signal<string | null>(null);
  private readonly unblockingUserIdsSignal = signal<ReadonlySet<string>>(new Set());
  private readonly unblockErrorSignal = signal<boolean>(false);

  /** Read-only signal of the current blocked users list. */
  readonly blockedUsers = this.blockedUsersSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly unblockingUserIds = this.unblockingUserIdsSignal.asReadonly();
  readonly unblockError = this.unblockErrorSignal.asReadonly();

  constructor() {
    void this.loadBlockedUsers();
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /** Fetches the full list of blocked user details from the backend and updates the signal. */
  async loadBlockedUsers(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const users = await firstValueFrom(
        this.http.get<BlockedUserResponse[]>(`${this.apiUrl}/blocks`, {
          headers: this.getHeaders(),
        }),
      );
      this.blockedUsersSignal.set(users ?? []);
    } catch {
      this.blockedUsersSignal.set([]);
      this.errorSignal.set('Failed to load blocked users');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Unblocks one user, preserving the current list when the request fails. */
  async unblockUser(userId: string): Promise<boolean> {
    if (!userId || this.unblockingUserIdsSignal().has(userId)) {
      return false;
    }

    this.unblockErrorSignal.set(false);
    this.setUnblocking(userId, true);

    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/blocks/${encodeURIComponent(userId)}`, {
          headers: this.getHeaders(),
        }),
      );
      this.blockedUsersSignal.update((users) => users.filter((user) => user.id !== userId));
      return true;
    } catch {
      this.unblockErrorSignal.set(true);
      return false;
    } finally {
      this.setUnblocking(userId, false);
    }
  }

  private setUnblocking(userId: string, pending: boolean): void {
    this.unblockingUserIdsSignal.update((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }
}
