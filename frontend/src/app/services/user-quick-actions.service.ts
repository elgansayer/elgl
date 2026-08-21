import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DirectConversationService } from './direct-conversation.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class UserQuickActionsService {
  private readonly userService = inject(UserService);
  private readonly conversations = inject(DirectConversationService);
  private readonly router = inject(Router);

  private readonly followOverrides = signal<Map<string, boolean>>(new Map());
  private readonly followPending = signal<Set<string>>(new Set());
  private readonly messagePending = signal<Set<string>>(new Set());
  private readonly errors = signal<Map<string, string>>(new Map());

  isFollowing(userId: string, fallback: boolean): boolean {
    return this.followOverrides().get(userId) ?? fallback;
  }

  isFollowPending(userId: string): boolean {
    return this.followPending().has(userId);
  }

  isMessagePending(userId: string): boolean {
    return this.messagePending().has(userId);
  }

  errorKey(userId: string): string | null {
    return this.errors().get(userId) ?? null;
  }

  async toggleFollow(userId: string, fallback: boolean): Promise<void> {
    if (this.isFollowPending(userId)) return;

    const wasFollowing = this.isFollowing(userId, fallback);
    this.setPending(this.followPending, userId, true);
    this.setError(userId, null);
    this.setFollowOverride(userId, !wasFollowing);

    try {
      if (wasFollowing) {
        await this.userService.unfollowUser(userId);
      } else {
        await this.userService.followUser(userId);
      }
    } catch {
      this.setFollowOverride(userId, wasFollowing);
      this.setError(userId, 'followList.followError');
    } finally {
      this.setPending(this.followPending, userId, false);
    }
  }

  async openMessage(userId: string): Promise<void> {
    if (this.isMessagePending(userId)) return;

    this.setPending(this.messagePending, userId, true);
    this.setError(userId, null);
    try {
      const roomId = await this.conversations.openOrCreate(userId);
      await this.router.navigate(['/chat', roomId]);
    } catch {
      this.setError(userId, 'common.error_generic');
    } finally {
      this.setPending(this.messagePending, userId, false);
    }
  }

  private setFollowOverride(userId: string, value: boolean): void {
    this.followOverrides.update((current) => {
      const next = new Map(current);
      next.set(userId, value);
      return next;
    });
  }

  private setError(userId: string, key: string | null): void {
    this.errors.update((current) => {
      const next = new Map(current);
      if (key) next.set(userId, key);
      else next.delete(userId);
      return next;
    });
  }

  private setPending(
    state: { update: (fn: (current: Set<string>) => Set<string>) => void },
    userId: string,
    pending: boolean,
  ): void {
    state.update((current) => {
      const next = new Set(current);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }
}
