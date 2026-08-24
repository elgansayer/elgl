import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';

export interface BlockedUserResponse {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_language?: string;
  target_languages?: string[];
}

interface UnblockResponse {
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class BlockedUsersService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly safetyService = inject(SafetyService);
  private readonly apiUrl = environment.apiUrl || '';

  private readonly blockedUsersSignal = signal<BlockedUserResponse[]>([]);
  private readonly loadingSignal = signal<boolean>(true);
  private readonly errorSignal = signal<string | null>(null);
  private readonly unblockErrorSignal = signal<string | null>(null);
  private readonly pendingUnblocksSignal = signal<ReadonlySet<string>>(new Set<string>());
  private loadGeneration = 0;

  readonly blockedUsers = this.blockedUsersSignal.asReadonly();
  readonly isLoading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly unblockError = this.unblockErrorSignal.asReadonly();
  readonly pendingUnblocks = this.pendingUnblocksSignal.asReadonly();

  constructor() {
    void this.loadBlockedUsers();
  }

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    return { Authorization: `Bearer ${token}` };
  }

  private sanitiseAvatarUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > 2048) return undefined;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private sanitiseText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, maxLength);
    return trimmed || undefined;
  }

  private parseBlockedUsers(value: unknown): BlockedUserResponse[] {
    if (!Array.isArray(value)) return [];

    const result: BlockedUserResponse[] = [];
    const seen = new Set<string>();
    for (const candidate of value.slice(0, 500)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const row = candidate as Record<string, unknown>;
      if (typeof row['id'] !== 'string' || !row['id'] || seen.has(row['id'])) continue;
      seen.add(row['id']);

      const targetLanguages = Array.isArray(row['target_languages'])
        ? row['target_languages']
            .map((item) => this.sanitiseText(item, 64))
            .filter((item): item is string => !!item)
            .slice(0, 3)
        : undefined;

      result.push({
        id: row['id'],
        display_name: this.sanitiseText(row['display_name'], 120),
        avatar_url: this.sanitiseAvatarUrl(row['avatar_url']),
        native_language: this.sanitiseText(row['native_language'], 64),
        target_languages: targetLanguages,
      });
    }
    return result;
  }

  /** Fetches blocked-account details. Existing data is retained during transient failures. */
  async loadBlockedUsers(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const users = await firstValueFrom(
        this.http.get<unknown>(`${this.apiUrl}/blocks`, {
          headers: this.getHeaders(),
        }),
      );
      if (generation !== this.loadGeneration) return;
      this.blockedUsersSignal.set(this.parseBlockedUsers(users));
    } catch {
      if (generation !== this.loadGeneration) return;
      this.errorSignal.set('Failed to load blocked users');
    } finally {
      if (generation === this.loadGeneration) {
        this.loadingSignal.set(false);
      }
    }
  }

  isUnblocking(userId: string): boolean {
    return this.pendingUnblocksSignal().has(userId);
  }

  /** Unblocks only after server confirmation; concurrent duplicate requests are suppressed. */
  async unblockUser(userId: string): Promise<void> {
    if (!userId || this.isUnblocking(userId)) return;

    this.unblockErrorSignal.set(null);
    this.pendingUnblocksSignal.update((current) => new Set([...current, userId]));
    try {
      const response = await firstValueFrom(
        this.http.delete<UnblockResponse>(`${this.apiUrl}/blocks/${encodeURIComponent(userId)}`, {
          headers: this.getHeaders(),
        }),
      );
      if (!response?.success) {
        throw new Error('Unblock was not confirmed');
      }
      this.blockedUsersSignal.update((previous) => previous.filter((user) => user.id !== userId));
      this.safetyService.setBlockedUserLocal(userId, false);
    } catch {
      this.unblockErrorSignal.set('Failed to unblock user');
      throw new Error('Failed to unblock user');
    } finally {
      this.pendingUnblocksSignal.update((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    }
  }

  clearUnblockError(): void {
    this.unblockErrorSignal.set(null);
  }
}
