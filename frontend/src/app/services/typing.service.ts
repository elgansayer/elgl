import { Injectable, inject, signal } from '@angular/core';
import { CentrifugeService, PublicationMeta } from './centrifuge.service';
import { AuthService } from './auth.service';
import { ChatService } from './chat.service';
import type { TypingUser } from '../components/primitives/typing-indicator/typing-indicator.component';

const MAX_DISPLAY_NAME_LENGTH = 60;
/** Bounds memory when a channel is flooded; rooms are far smaller than this. */
const MAX_TRACKED_TYPISTS = 20;

/**
 * Typing payloads come from other clients, so the name is only a display hint:
 * control characters and bidirectional overrides are removed and the length is
 * capped. An empty result lets the UI show its translated "someone" fallback.
 */
function sanitiseDisplayName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069]/gu, '')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
}

@Injectable({
  providedIn: 'root',
})
export class TypingService {
  private centrifugeService = inject(CentrifugeService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);

  readonly typingUsers = signal<TypingUser[]>([]);

  private readonly TYPING_TIMEOUT_MS = 3000;
  private readonly THROTTLE_MS = 2000;

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
          (data: unknown, meta?: PublicationMeta) => {
            if (generation !== this.connectionGeneration || this.currentRoomId !== roomId) return;
            this.handleTypingEvent(data, meta?.publisherId);
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
    if (this.currentRoomId) {
      // subscribe() also records a desired channel while the transport client
      // is unavailable. Remove that intent even when no live handle exists.
      this.centrifugeService.unsubscribe(`chat:${this.currentRoomId}:typing`);
    }
    this.currentSubscription = null;
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

    // The API verifies room membership and publishes the authenticated user id.
    void this.chatService.sendTypingIndicator(this.currentRoomId, isTyping);
  }

  private isTypingPayload(data: unknown): data is Record<string, unknown> {
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  }

  private handleTypingEvent(data: unknown, publisherId?: string): void {
    if (!this.isTypingPayload(data)) return;
    if (
      typeof data['timestamp'] !== 'number' ||
      !Number.isFinite(data['timestamp']) ||
      typeof data['typing'] !== 'boolean'
    ) {
      return;
    }

    const claimedUserId = typeof data['userId'] === 'string' ? data['userId'] : '';
    // A client-published event carries the server-verified publisher. A payload
    // that names someone else is an impersonation attempt and is dropped.
    if (publisherId && claimedUserId && claimedUserId !== publisherId) return;

    const userId = publisherId || claimedUserId;
    if (!userId) return;

    const currentUserId = this.authService.currentUser()?.id;
    if (userId === currentUserId) return;

    if (this.typingTimers.has(userId)) {
      clearTimeout(this.typingTimers.get(userId));
    }

    if (data['typing']) {
      const typingUser: TypingUser = {
        userId,
        displayName: sanitiseDisplayName(data['displayName']),
      };

      this.typingUsers.update((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return [...filtered, typingUser].slice(-MAX_TRACKED_TYPISTS);
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
