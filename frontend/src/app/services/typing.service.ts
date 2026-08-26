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
  private readonly MAX_EVENT_AGE_MS = 10_000;
  private readonly MAX_FUTURE_SKEW_MS = 5000;
  private readonly MAX_TYPING_USERS = 19;
  private readonly MAX_USER_ID_LENGTH = 128;
  private readonly MAX_DISPLAY_NAME_LENGTH = 80;
  private readonly MAX_AVATAR_URL_LENGTH = 2048;

  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastPublishTime = 0;
  private currentRoomId: string | null = null;
  private currentSubscription: { unsubscribe: () => void } | null = null;
  private connectionGeneration = 0;

  connect(roomId: string): void {
    if (!roomId || this.currentRoomId === roomId) return;

    this.disconnect();
    this.currentRoomId = roomId;
    const generation = ++this.connectionGeneration;

    void this.centrifugeService
      .connect()
      .then(() => {
        // Centrifuge connection establishment is asynchronous. A late callback
        // from a room we already left must never resurrect a stale typing
        // subscription or overwrite the active room subscription.
        if (generation !== this.connectionGeneration || this.currentRoomId !== roomId) return;

        this.currentSubscription = this.centrifugeService.subscribe(
          `chat:${roomId}:typing`,
          (data: unknown) => {
            if (generation !== this.connectionGeneration || this.currentRoomId !== roomId) return;
            this.handleTypingEvent(data);
          },
        );
      })
      .catch(() => {
        // Typing indicators are ephemeral presence hints. A realtime provider
        // outage must not break the chat room; a later room reconnect can retry.
      });
  }

  disconnect(): void {
    this.connectionGeneration++;
    if (this.currentRoomId && this.currentSubscription) {
      this.centrifugeService.unsubscribe(`chat:${this.currentRoomId}:typing`);
      this.currentSubscription = null;
    }
    this.currentRoomId = null;
    this.lastPublishTime = 0;
    this.clearAllTimers();
    this.typingUsers.set([]);
  }

  sendTyping(isTyping: boolean): void {
    if (!this.currentRoomId) return;

    const user = this.authService.currentUser();
    if (!user?.id) return;

    const now = Date.now();
    if (isTyping) {
      if (now - this.lastPublishTime < this.THROTTLE_MS) return;
      this.lastPublishTime = now;
    } else {
      // A stop event is always delivered and resets the throttle window so a
      // user who immediately starts typing again is announced without delay.
      this.lastPublishTime = 0;
    }

    this.centrifugeService.publish(`chat:${this.currentRoomId}:typing`, {
      userId: user.id.slice(0, this.MAX_USER_ID_LENGTH),
      displayName: String(user.user_metadata?.['display_name'] ?? '').
        trim()
        .slice(0, this.MAX_DISPLAY_NAME_LENGTH),
      avatarUrl: this.safeAvatarUrl(String(user.user_metadata?.['avatar_url'] ?? '')),
      typing: isTyping,
      timestamp: now,
    });
  }

  private isTypingPayload(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  private handleTypingEvent(data: unknown): void {
    if (!this.isTypingPayload(data)) return;
    if (
      typeof data['userId'] !== 'string' ||
      data['userId'].trim().length === 0 ||
      data['userId'].length > this.MAX_USER_ID_LENGTH ||
      typeof data['timestamp'] !== 'number' ||
      !Number.isFinite(data['timestamp']) ||
      typeof data['typing'] !== 'boolean'
    ) {
      return;
    }

    const now = Date.now();
    const timestamp = data['timestamp'];
    if (timestamp < now - this.MAX_EVENT_AGE_MS || timestamp > now + this.MAX_FUTURE_SKEW_MS) {
      return;
    }

    const currentUserId = this.authService.currentUser()?.id;
    if (data['userId'] === currentUserId) return;

    const userId = data['userId'].trim();

    if (this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId));
    }

    if (data['typing']) {
      const displayName =
        typeof data['displayName'] === 'string'
          ? data['displayName'].trim().slice(0, this.MAX_DISPLAY_NAME_LENGTH)
          : '';
      const avatarUrl =
        typeof data['avatarUrl'] === 'string' ? this.safeAvatarUrl(data['avatarUrl']) : undefined;
      const typingUser: TypingUser = {
        userId,
        displayName: displayName || 'Someone',
        avatarUrl: avatarUrl || undefined,
      };

      this.typingUsers.update((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, typingUser].slice(-this.MAX_TYPING_USERS);
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

  private safeAvatarUrl(value: string): string {
    const candidate = value.trim();
    if (!candidate || candidate.length > this.MAX_AVATAR_URL_LENGTH) return '';
    if (candidate.startsWith('/')) return candidate;

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? candidate : '';
    } catch {
      return '';
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
