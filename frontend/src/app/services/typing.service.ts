import { Injectable, inject, signal } from '@angular/core';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';
import type { TypingUser } from '../components/primitives/typing-indicator/typing-indicator.component';

@Injectable({
  providedIn: 'root',
})
export class TypingService {
  private centrifugeService = inject(CentrifugeService);
  private authService = inject(AuthService);

  readonly typingUsers = signal<TypingUser[]>([]);

  private readonly TYPING_TIMEOUT_MS = 3000;
  private readonly THROTTLE_MS = 2000;

  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastPublishTime = 0;
  private currentRoomId: string | null = null;
  private currentSubscription: { unsubscribe: () => void } | null = null;

  connect(roomId: string): void {
    if (this.currentRoomId === roomId) return;
    this.disconnect();
    this.currentRoomId = roomId;

    this.centrifugeService.connect().then(() => {
      this.currentSubscription = this.centrifugeService.subscribe(
        `chat:${roomId}:typing`,
        (data: unknown) => {
          this.handleTypingEvent(data);
        },
      );
    });
  }

  disconnect(): void {
    if (this.currentRoomId && this.currentSubscription) {
      this.centrifugeService.unsubscribe(`chat:${this.currentRoomId}:typing`);
      this.currentSubscription = null;
    }
    this.currentRoomId = null;
    this.clearAllTimers();
    this.typingUsers.set([]);
  }

  sendTyping(isTyping: boolean): void {
    if (!this.currentRoomId) return;
    const now = Date.now();
    if (isTyping && now - this.lastPublishTime < this.THROTTLE_MS) return;
    this.lastPublishTime = now;

    const user = this.authService.currentUser();
    this.centrifugeService.publish(`chat:${this.currentRoomId}:typing`, {
      userId: user?.id ?? '',
      displayName: String(user?.user_metadata?.['display_name'] ?? ''),
      avatarUrl: String(user?.user_metadata?.['avatar_url'] ?? ''),
      typing: isTyping,
      timestamp: now,
    });
  }

  private isTypingPayload(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  private handleTypingEvent(data: unknown): void {
    if (!this.isTypingPayload(data)) return;
    if (typeof data['userId'] !== 'string' || typeof data['timestamp'] !== 'number') return;

    const currentUserId = this.authService.currentUser()?.id;
    if (data['userId'] === currentUserId) return;

    const userId: string = data['userId'];

    if (this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId));
    }

    if (data['typing'] !== false) {
      const typingUser: TypingUser = {
        userId,
        displayName: typeof data['displayName'] === 'string' ? data['displayName'] : 'Someone',
        avatarUrl: typeof data['avatarUrl'] === 'string' ? data['avatarUrl'] : undefined,
      };

      this.typingUsers.update((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, typingUser];
      });

      this.typingTimers.set(
        userId,
        setTimeout(() => {
          this.removeUser(userId);
        }, this.TYPING_TIMEOUT_MS),
      );
    } else {
      this.removeUser(userId);
    }
  }

  private removeUser(userId: string): void {
    this.typingUsers.update((prev) => prev.filter((u) => u.userId !== userId));
    if (this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId));
      this.typingTimers.delete(userId);
    }
  }

  private clearAllTimers(): void {
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
  }
}