import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { SafetyService } from './safety.service';

export interface BlockedUserResponse {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_languages?: string[];
  blocked_at?: string;
}

interface BlockedUserApiResponse {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_language?: string;
  blocked_at?: string;
}

@Injectable({ providedIn: 'root' })
export class BlockedUsersService {
  private readonly api = inject(ApiService);
  private readonly safetyService = inject(SafetyService);
  private readonly apiUrl = environment.apiUrl || '';

  private readonly blockedUsersSignal = signal<BlockedUserResponse[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly errorSignal = signal<string | null>(null);
  private readonly pendingUnblocks = new Set<string>();

  readonly blockedUsers = this.blockedUsersSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor() {
    void this.loadBlockedUsers();
  }

  async loadBlockedUsers(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const users = await this.api.get<BlockedUserApiResponse[]>(
        `${this.apiUrl}/safety/blocked-users-details`,
      );
      this.blockedUsersSignal.set(users.map((user) => this.toBlockedUserResponse(user)));
    } catch {
      // Preserve any already-loaded rows so a transient refresh failure does not
      // misrepresent an unavailable backend as an empty block list.
      this.errorSignal.set('Failed to load blocked users');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async unblockUser(userId: string): Promise<void> {
    if (this.pendingUnblocks.has(userId)) return;

    this.pendingUnblocks.add(userId);
    this.errorSignal.set(null);

    try {
      const result = await this.api.post<{ success: boolean }>(
        `${this.apiUrl}/safety/unblock/${encodeURIComponent(userId)}`,
        {},
      );
      if (!result.success) {
        throw new Error('Unblock request was not confirmed');
      }

      this.safetyService.setBlockedUserLocal(userId, false);
      this.blockedUsersSignal.update((previous) => previous.filter((user) => user.id !== userId));
    } catch {
      // Keep the row visible when the mutation is not confirmed. The page's
      // existing error state gives the user an explicit retry path.
      this.errorSignal.set('Failed to unblock user');
    } finally {
      this.pendingUnblocks.delete(userId);
    }
  }

  private toBlockedUserResponse(user: BlockedUserApiResponse): BlockedUserResponse {
    return {
      id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      native_language: user.native_language,
      target_languages: user.target_language ? [user.target_language] : [],
      blocked_at: user.blocked_at,
    };
  }
}
