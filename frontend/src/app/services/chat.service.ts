import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { OfflineQueueService } from './offline-queue.service';
import { NetworkStatusService } from './network-status.service';
import { HapticFeedbackService } from './haptic-feedback.service';
import { ChatCacheService } from './chat-cache.service';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';
import { I18nService } from './i18n.service';
import { showErrorToast } from './toast.service';
import { Router } from '@angular/router';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Client errors that can succeed on a later attempt, for example once the session is refreshed. */
const RETRYABLE_CLIENT_ERROR_STATUSES: ReadonlySet<number> = new Set([401, 408, 425, 429]);

/**
 * True when the server definitively refused a replayed message (validation, a block, a missing
 * room, an oversized payload). Network failures (status 0), expired sessions, throttling and
 * server errors are not permanent: the message stays queued and is retried.
 */
function isPermanentRejection(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status >= 400 &&
    error.status < 500 &&
    !RETRYABLE_CLIENT_ERROR_STATUSES.has(error.status)
  );
}

/** Outcome of replaying the offline message queue. */
export interface OfflineSyncResult {
  /** Delivered, or already stored by an earlier attempt, and removed from the queue. */
  sent: number;
  /** Still queued because delivery or dequeueing failed; retried on the next trigger. */
  failed: number;
  /** Permanently refused by the server and removed from the queue. */
  rejected: number;
}

export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface GiftPayload {
  gift_id: string;
  gift_name: string;
  gift_icon: string;
  coin_value: number;
  animation_type?: string | null;
  animation_url?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength;
}

function isOptionalBoundedString(value: unknown, maximumLength: number): boolean {
  return value == null || isBoundedString(value, maximumLength);
}

/** Validates gift data received from REST, cache, or an untrusted realtime publication. */
export function isGiftPayload(value: unknown): value is GiftPayload {
  if (!isRecord(value)) return false;

  return (
    isBoundedString(value['gift_id'], 128) &&
    isBoundedString(value['gift_name'], 120) &&
    isBoundedString(value['gift_icon'], 64) &&
    typeof value['coin_value'] === 'number' &&
    Number.isSafeInteger(value['coin_value']) &&
    value['coin_value'] >= 0 &&
    isOptionalBoundedString(value['animation_type'], 64) &&
    isOptionalBoundedString(value['animation_url'], 512) &&
    isOptionalBoundedString(value['sender_name'], 120) &&
    isOptionalBoundedString(value['receiver_name'], 120)
  );
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string | null;
  message_type:
    | 'text'
    | 'voice'
    | 'correction'
    | 'doodle'
    | 'sticker'
    | 'system'
    | 'correction_request'
    | 'status_reply'
    | 'view_once_media'
    | 'gift';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  correction_request_payload?: {
    original_text: string;
    target_language?: string;
  };
  system_event?: {
    type: string;
    [param: string]: unknown;
  };
  gift_payload?: GiftPayload;
  is_read: boolean;
  delivery_status?: 'sent' | 'delivered' | 'read';
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  /** OpenGraph link preview scraped from URLs in the message */
  link_preview?: LinkPreview | null;
  /** ID of the parent message this replies to (threaded replies) */
  reply_to_id?: string;
  /** Preview of the parent message for inline display */
  reply_preview?: {
    text_content: string;
    sender_id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  /** Contains data when the message is a reply to a status update */
  status_reply_payload?: {
    status_update_id: string;
    status_text: string;
  };
  /** Whether the media in this message disappears after opening */
  is_view_once?: boolean;
  /** Timestamp when the view‑once media was first accessed (null = not yet opened) */
  viewed_at?: string | null;

  /** User IDs for whom the message has been soft‑deleted (self‑delete only) */
  deleted_for_user_ids?: string[];

  /** True when the message has been soft‑deleted for all users */
  is_deleted?: boolean;

  /** Whether this message was forwarded from another conversation */
  is_forwarded?: boolean;

  /** Whether this message content is encrypted before storage and delivery */
  is_encrypted?: boolean;

  /** Armoured ciphertext and IV envelope for encrypted message content */
  encrypted_payload?: string | null;
}

export interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  readAt: string;
}

export interface MessageReceiptStatus {
  messageId: string;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  readBy: ReadReceiptUser[];
  totalMembers: number;
}

export interface FavouriteRecord {
  id: string;
  user_id: string;
  item_type: string;
  item_payload: ChatMessage;
  notes?: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  is_online: boolean;
  is_pinned: boolean;
  is_locked?: boolean;
  is_vip?: boolean;
  native_languages?: string[];
  created_at: string;
  admin_id?: string | null;
  wallpaper_url?: string | null;
}

export interface GroupMember {
  user_id: string;
  user?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
    native_language?: string | null;
    target_languages?: string[] | null;
    is_vip?: boolean | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly labels = signal<string[]>([]);

  async getLabels(): Promise<string[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    const response = await firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/labels`, { headers: this.getHeaders() }),
    );
    this.labels.set(response);
    return response;
  }

  async assignLabelToRoom(roomId: string, label: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/labels`,
        { room_id: roomId, label },
        { headers: this.getHeaders() },
      ),
    );
  }

  async removeLabelFromRoom(roomId: string, label: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/labels`, {
        body: { room_id: roomId, label },
        headers: this.getHeaders(),
      }),
    );
  }
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private offlineQueue = inject(OfflineQueueService);
  private networkStatus = inject(NetworkStatusService);
  private hapticFeedback = inject(HapticFeedbackService);
  private chatCache = inject(ChatCacheService);
  private router = inject(Router);
  private personalChatEncryption = inject(PersonalChatEncryptionService);
  private i18n = inject(I18nService);
  private baseUrl = `${environment.apiUrl}/chat`;

  // Blocked user list is loaded on demand, never in the constructor,
  // to avoid premature HTTP calls that break test environments.
  private readonly blockedUsers = signal<Set<string>>(new Set<string>());

  /** Exposed for UI: count of messages queued offline waiting for sync. */
  readonly queuedCount = this.offlineQueue.queueSize;

  async getMessageReceipts(messageId: string): Promise<MessageReceiptStatus> {
    return firstValueFrom(
      this.http.get<MessageReceiptStatus>(
        `${environment.apiUrl}/chat/messages/${messageId}/receipts`,
      ),
    );
  }

  /** The replay currently running, shared so overlapping triggers never send a message twice. */
  private offlineSyncInFlight: Promise<OfflineSyncResult> | null = null;

  /** True while a signed-in account has connectivity, which is when queued messages can be sent. */
  private readonly canReplayOfflineQueue = computed(
    () => !!this.authService.currentUser()?.id && this.networkStatus.isOnline(),
  );

  constructor() {
    // Replay the offline queue each time a signed-in account gains connectivity: on reconnecting,
    // on signing in, and at start-up for messages a previous session left queued. Syncing to the
    // network is a side effect that cannot be expressed declaratively.
    effect(() => {
      if (this.canReplayOfflineQueue()) {
        untracked(() => void this.syncOfflineMessages());
      }
    });
  }

  readonly isUserBlocked = computed(() => {
    const blocked = this.blockedUsers();
    return (userId: string) => blocked.has(userId);
  });

  addBlockedUser(userId: string): void {
    this.blockedUsers.update((blocked) => {
      const newSet = new Set(blocked);
      newSet.add(userId);
      return newSet;
    });
  }

  removeBlockedUser(userId: string): void {
    this.blockedUsers.update((blocked) => {
      const newSet = new Set(blocked);
      newSet.delete(userId);
      return newSet;
    });
  }

  getBlockedUsers(): string[] {
    return Array.from(this.blockedUsers());
  }

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  private async prepareTextForTransport(
    roomId: string,
    text: string | undefined,
    offline: boolean,
  ): Promise<{
    textContent: string | undefined;
    isEncrypted: boolean;
    encryptedPayload: string | undefined;
  }> {
    if (!text) {
      return {
        textContent: text,
        isEncrypted: false,
        encryptedPayload: undefined,
      };
    }

    if (offline) {
      const cachedRooms = await this.chatCache.getCachedRooms();
      const room = cachedRooms?.find((candidate) => candidate.id === roomId);
      if (!room) {
        throw new Error('Room security state is unavailable while offline.');
      }
      if (room.admin_id != null) {
        return {
          textContent: text,
          isEncrypted: false,
          encryptedPayload: undefined,
        };
      }

      const encrypted = await this.personalChatEncryption.encryptCachedMessage(roomId, text);
      return {
        textContent: encrypted.payload,
        isEncrypted: true,
        encryptedPayload: encrypted.payload,
      };
    }

    if (!(await this.personalChatEncryption.isRoomE2eeCapable(roomId))) {
      return {
        textContent: text,
        isEncrypted: false,
        encryptedPayload: undefined,
      };
    }

    const encrypted = await this.personalChatEncryption.encryptMessage(roomId, text);
    return {
      textContent: encrypted.payload,
      isEncrypted: true,
      encryptedPayload: encrypted.payload,
    };
  }

  async sendMessage(payload: {
    room_id: string;
    message_type:
      | 'text'
      | 'voice'
      | 'correction'
      | 'doodle'
      | 'sticker'
      | 'correction_request'
      | 'status_reply';
    text_content?: string;
    media_url?: string;
    correction_payload?: CorrectionPayload;
    correction_request_payload?: {
      original_text: string;
      target_language?: string;
    };
    reply_to_id?: string;
    status_reply_payload?: {
      status_update_id: string;
      status_text: string;
    };
  }): Promise<ChatMessage> {
    const currentUser = this.authService.currentUser();
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    const preparedText = await this.prepareTextForTransport(
      payload.room_id,
      payload.text_content,
      offline,
    );

    // Offline: queue the message in IndexedDB and return immediately.
    if (offline) {
      const queuedMsg: ChatMessage = {
        id: crypto.randomUUID(),
        room_id: payload.room_id,
        sender_id: currentUser?.id || '',
        message_type: payload.message_type,
        text_content: preparedText.textContent,
        media_url: payload.media_url,
        correction_payload: payload.correction_payload,
        correction_request_payload: payload.correction_request_payload,
        reply_to_id: payload.reply_to_id,
        status_reply_payload: payload.status_reply_payload,
        is_encrypted: preparedText.isEncrypted,
        encrypted_payload: preparedText.encryptedPayload,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await this.offlineQueue.enqueueMessage(queuedMsg);
      this.hapticFeedback.tap();
      return { ...queuedMsg, text_content: payload.text_content };
    }

    // Check if the receiver is blocked before sending
    if (currentUser?.id) {
      // Get room members to find the receiver
      const roomMembers = await firstValueFrom(
        this.http.get<{ user_id: string }[]>(`${this.baseUrl}/rooms/${payload.room_id}/members`, {
          headers: this.getHeaders(),
        }),
      ).catch(() => []);
      if (roomMembers && roomMembers.length > 0) {
        const receiverId = roomMembers.find((m) => m.user_id !== currentUser.id)?.user_id;
        if (receiverId) {
          const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
          if (blockedIds.includes(receiverId)) {
            throw new Error('You cannot send messages to this user.');
          }
        }
      }
    }

    const outgoingPayload = {
      ...payload,
      text_content: preparedText.textContent,
      is_encrypted: preparedText.isEncrypted,
      encrypted_payload: preparedText.encryptedPayload,
    };

    const message = await firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, outgoingPayload, {
        headers: this.getHeaders(),
      }),
    );
    this.hapticFeedback.tap();

    // If message is encrypted, restore original plaintext for local optimistic UI and cache
    if (message.is_encrypted && payload.text_content) {
      message.text_content = payload.text_content;
    }

    // Append the new message to the room's cached messages so the cache stays warm
    void this.chatCache.appendCachedMessage(payload.room_id, message);
    return message;
  }

  /** Attempt to sync all offline queued messages.
   * Replays the queued offline messages of the signed-in account, oldest first.
   *
   * Overlapping calls share one replay, so a message is never sent twice concurrently. Each
   * message is sent with its queue id as `client_message_id`, which the API stores as the message
   * id: if a response is lost the retry returns the original message instead of a duplicate.
   * A failed message holds back later messages of the same room so none overtakes it, while other
   * rooms continue. The server permanently refusing a message removes it from the queue.
   */
  syncOfflineMessages(): Promise<OfflineSyncResult> {
    this.offlineSyncInFlight ??= this.replayOfflineQueue().finally(() => {
      this.offlineSyncInFlight = null;
    });
    return this.offlineSyncInFlight;
  }

  private async replayOfflineQueue(): Promise<OfflineSyncResult> {
    const result: OfflineSyncResult = { sent: 0, failed: 0, rejected: 0 };
    if (!this.authService.getAccessToken()) return result;

    let messages: ChatMessage[];
    try {
      messages = await this.offlineQueue.getQueuedMessages();
    } catch {
      // Fixed diagnostic: provider errors can carry private content.
      console.error('chat.offline_queue_unreadable');
      return result;
    }

    const stalledRooms = new Set<string>();
    for (const message of messages) {
      if (stalledRooms.has(message.room_id)) {
        result.failed++;
        continue;
      }
      const outcome = await this.replayQueuedMessage(message);
      if (outcome === 'retry') {
        stalledRooms.add(message.room_id);
        result.failed++;
      } else {
        result[outcome]++;
      }
    }

    if (result.failed > 0 || result.rejected > 0) {
      console.warn('chat.offline_sync_incomplete', { ...result });
    }
    if (result.rejected > 0) {
      showErrorToast(
        this.i18n.translate('chatRoom.offlineMessagesRejected', { count: result.rejected }),
      );
    }
    return result;
  }

  /** Sends one queued message and dequeues it unless it must be retried later. */
  private async replayQueuedMessage(message: ChatMessage): Promise<'sent' | 'rejected' | 'retry'> {
    let outcome: 'sent' | 'rejected' = 'sent';
    try {
      await firstValueFrom(
        this.http.post<ChatMessage>(
          `${this.baseUrl}/messages`,
          {
            room_id: message.room_id,
            message_type: message.message_type,
            text_content: message.text_content,
            media_url: message.media_url,
            correction_payload: message.correction_payload,
            correction_request_payload: message.correction_request_payload,
            reply_to_id: message.reply_to_id,
            status_reply_payload: message.status_reply_payload,
            is_encrypted: message.is_encrypted,
            encrypted_payload: message.encrypted_payload,
            client_message_id: message.id,
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch (error) {
      if (!isPermanentRejection(error)) return 'retry';
      outcome = 'rejected';
    }

    try {
      await this.offlineQueue.removeMessage(message.id);
    } catch {
      // Still queued, so the next replay resends it. The API answers that idempotently.
      return 'retry';
    }
    return outcome;
  }

  async getMessages(roomId: string, search?: string): Promise<ChatMessage[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }

    const hasSearch = search && search.trim().length > 0;

    // Try cache first for normal (non-search) loads
    if (!hasSearch) {
      const cached = await this.chatCache.getCachedMessages(roomId);
      if (cached) {
        // Still filter blocked users from cached results
        const currentUser = this.authService.currentUser();
        if (currentUser?.id) {
          const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
          if (blockedIds.length > 0) {
            return cached.filter((msg) =>
              msg.sender_id ? !blockedIds.includes(msg.sender_id) : true,
            );
          }
        }
        return cached;
      }
    }

    let params = new HttpParams();
    if (hasSearch) {
      params = params.set('search', search!.trim());
    }

    const rawMessages = await firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${roomId}`, {
        headers: this.getHeaders(),
        params,
      }),
    );

    const messages = await Promise.all(
      rawMessages.map(async (msg) => {
        if (msg.is_encrypted && msg.encrypted_payload) {
          try {
            const decrypted = await this.personalChatEncryption.decryptMessage(
              roomId,
              msg.encrypted_payload,
            );
            return { ...msg, text_content: decrypted };
          } catch {
            return {
              ...msg,
              text_content: this.i18n.translate('chatRoom.encryptedMessageUnavailable'),
            };
          }
        }
        return msg;
      }),
    );

    // Cache the result for non-search loads
    if (!hasSearch) {
      void this.chatCache.cacheMessages(roomId, messages);
    }

    // Filter out messages from blocked users
    const currentUser = this.authService.currentUser();
    if (currentUser?.id) {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
      if (blockedIds.length > 0) {
        return messages.filter((msg) =>
          msg.sender_id ? !blockedIds.includes(msg.sender_id) : true,
        );
      }
    }

    return messages;
  }

  async getUnreadCount(): Promise<number> {
    if (!this.authService.getAccessToken()) {
      return 0;
    }

    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/unread-count`, {
        headers: this.getHeaders(),
      }),
    );

    if (!isRecord(response)) {
      throw new Error('Invalid unread count response');
    }
    const unreadCount = response['unreadCount'];
    if (typeof unreadCount !== 'number' || !Number.isSafeInteger(unreadCount) || unreadCount < 0) {
      throw new Error('Invalid unread count response');
    }
    return unreadCount;
  }

  async getRooms(): Promise<ChatRoom[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }

    // Try cache first
    const cached = await this.chatCache.getCachedRooms();
    if (cached) {
      return cached;
    }

    const rooms = await firstValueFrom(
      this.http.get<ChatRoom[]>(`${this.baseUrl}/rooms`, { headers: this.getHeaders() }),
    );

    // Cache the result
    void this.chatCache.cacheRooms(rooms);

    // Filter out rooms where the other participant is blocked
    const currentUser = this.authService.currentUser();
    if (currentUser?.id) {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
      if (blockedIds.length > 0) {
        return rooms;
      }
    }

    return rooms;
  }

  /**
   * Sends a reply to a status update, creating a direct chat room if needed.
   */
  async replyToStatusUpdate(payload: {
    target_user_id: string;
    status_update_id: string;
    status_text: string;
    text?: string;
  }): Promise<ChatMessage> {
    try {
      const response = await firstValueFrom(
        this.http.post<ChatMessage>(`${this.baseUrl}/messages/status-reply`, payload, {
          headers: this.getHeaders(),
        }),
      );
      this.hapticFeedback.tap();
      this.router.navigate(['/chat', response.room_id]).catch(() => undefined);
      return response;
    } catch (cause) {
      console.error('Failed to reply to status update:', cause);
      throw new Error('Could not send reply to status update. Please try again.', {
        cause,
      });
    }
  }

  // ---- Chat Lock methods ----

  async lockChat(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/rooms/${roomId}/lock`, {}, { headers: this.getHeaders() }),
    );
  }

  async unlockChat(roomId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/rooms/${roomId}/unlock`, {}, { headers: this.getHeaders() }),
    );
  }

  async getLockedRoomIds(): Promise<string[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/locked-rooms`, { headers: this.getHeaders() }),
    );
  }

  async reportMessage(messageId: string, reason: string): Promise<void> {
    const response = await fetch('/safety/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify({
        reported_id: messageId,
        reason: reason,
        context_url: window.location.href,
      }),
    });
    if (!response.ok) throw new Error('Failed to report message');
  }

  /**
   * Search messages across all conversations (or within a specific room).
   * Uses a request body so private search text is not exposed in the URL.
   */
  async searchMessages(term: string, roomId?: string, limit = 50): Promise<ChatMessage[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    const trimmedTerm = term.trim();
    const messages = await firstValueFrom(
      this.http.post<ChatMessage[]>(
        `${this.baseUrl}/search`,
        {
          term: trimmedTerm,
          ...(roomId ? { roomId } : {}),
          limit,
        },
        { headers: this.getHeaders() },
      ),
    );

    const literalTerm = trimmedTerm.toLocaleLowerCase();
    const searchableMessages = await Promise.all(
      messages.map(async (message) => {
        if (!message.is_encrypted || !message.encrypted_payload) return message;
        try {
          const textContent = await this.personalChatEncryption.decryptMessage(
            message.room_id,
            message.encrypted_payload,
          );
          return { ...message, text_content: textContent };
        } catch {
          return null;
        }
      }),
    );

    return searchableMessages
      .filter((message): message is ChatMessage => message !== null)
      .filter(
        (message) =>
          !message.is_encrypted ||
          (message.text_content?.toLocaleLowerCase().includes(literalTerm) ?? false),
      )
      .slice(0, limit);
  }

  async loadBlockedUsers(): Promise<void> {
    try {
      const blockedIds = await this.safetyService.getBlockedIdsAsync();
      this.blockedUsers.set(new Set(blockedIds));
    } catch (e) {
      console.error('Failed to load blocked users:', e);
    }
  }

  async isBlocked(userId: string): Promise<boolean> {
    if (!this.authService.getAccessToken()) {
      return false;
    }
    try {
      const response = await firstValueFrom(
        this.http.get<{ blocked: boolean }>(`${environment.apiUrl}/safety/is-blocked/${userId}`, {
          headers: this.getHeaders(),
        }),
      );
      return response.blocked;
    } catch (e) {
      console.error('Failed to check block status:', e);
      return false;
    }
  }

  /**
   * Sends a correction to a message (any user can correct others' messages).
   */
  async correctMessage(
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(
        `${this.baseUrl}/messages/${messageId}/correct`,
        { correctedText, explanation },
        { headers: this.getHeaders() },
      ),
    );
  }

  /**
   * Edits an existing message (the sender can fix their own message).
   * This replaces the text_content and correction_payload in the server.
   */
  async fixMessage(
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.patch<ChatMessage>(
        `${this.baseUrl}/messages/${messageId}/fix`,
        { correctedText, explanation },
        { headers: this.getHeaders() },
      ),
    );
  }

  async createGroup(name: string, memberIds: string[]): Promise<ChatRoom> {
    const room = await firstValueFrom(
      this.http.post<ChatRoom>(
        `${this.baseUrl}/groups`,
        { name, memberIds },
        { headers: this.getHeaders() },
      ),
    );
    void this.chatCache.invalidateRooms();
    return room;
  }

  async renameGroup(roomId: string, name: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/groups/${roomId}/rename`,
        { name },
        { headers: this.getHeaders() },
      ),
    );
    void this.chatCache.invalidateRooms();
  }

  async addGroupMembers(roomId: string, memberIds: string[]): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/groups/${roomId}/members`,
        { memberIds },
        { headers: this.getHeaders() },
      ),
    );
  }

  async removeGroupMember(roomId: string, memberId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/groups/${roomId}/members/${memberId}`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async getGroupMembers(roomId: string): Promise<GroupMember[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    return firstValueFrom(
      this.http.get<GroupMember[]>(`${this.baseUrl}/groups/${roomId}/members`, {
        headers: this.getHeaders(),
      }),
    );
  }

  async getRoomMembers(
    roomId: string,
  ): Promise<{ user_id: string; display_name?: string; avatar_url?: string | null }[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    return firstValueFrom(
      this.http.get<{ user_id: string; display_name?: string; avatar_url?: string | null }[]>(
        `${this.baseUrl}/rooms/${roomId}/members`,
        { headers: this.getHeaders() },
      ),
    );
  }

  async translateText(text: string, targetLanguage: string): Promise<{ translated_text: string }> {
    return firstValueFrom(
      this.http.post<{ translated_text: string }>(
        `${environment.apiUrl}/nlp/translate`,
        { text, target_language: targetLanguage },
        { headers: this.getHeaders() },
      ),
    );
  }

  async transcribeVoice(
    audioUrl: string,
  ): Promise<{ original_text: string; detected_language: string; confidence: number }> {
    return firstValueFrom(
      this.http.post<{ original_text: string; detected_language: string; confidence: number }>(
        `${environment.apiUrl}/nlp/transcribe-voice`,
        { audio_url: audioUrl },
        { headers: this.getHeaders() },
      ),
    );
  }

  async getSuggestedReplies(roomId: string, recentMessages?: ChatMessage[]): Promise<string[]> {
    const body = {
      room_id: roomId,
      recent_messages: recentMessages
        ? recentMessages.map((m) => ({ sender_id: m.sender_id, text: m.text_content }))
        : undefined,
    };
    const response = await firstValueFrom(
      this.http.post<{ suggestions: string[] }>(`${this.baseUrl}/suggested-replies`, body, {
        headers: this.getHeaders(),
      }),
    );
    return response.suggestions;
  }

  /**
   * Retrieves AI‑generated conversation starters for a new chat window.
   * Uses the partner's profile (display name, bio, target language) to build
   * personalised questions.
   */
  async getConversationStarters(partnerId: string): Promise<string[]> {
    const response = await firstValueFrom(
      this.http.post<{ suggestions: string[] }>(
        `${this.baseUrl}/conversation-starters`,
        { partnerId },
        { headers: this.getHeaders() },
      ),
    );
    return response.suggestions;
  }

  /**
   * Requests a real‑time translation of the given text for the voice‑room overlay.
   * The backend will detect the source language and return the translated text.
   */
  async translateVoiceroomText(
    text: string,
    targetLanguage: string,
  ): Promise<{ translated_text: string; detected_language: string }> {
    return firstValueFrom(
      this.http.post<{ translated_text: string; detected_language: string }>(
        `${environment.apiUrl}/chat/translate-voiceroom`,
        { text, target_language: targetLanguage },
        { headers: this.getHeaders() },
      ),
    );
  }

  /**
   * Fetches the full message history for the given chat room (for export purposes).
   */
  async exportChatHistory(roomId: string): Promise<ChatMessage[]> {
    return firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/rooms/${roomId}/export`, {
        headers: this.getHeaders(),
      }),
    );
  }

  /**
   * Downloads the chat history as a JSON file directly in the browser.
   */
  async downloadChatHistory(roomId: string): Promise<void> {
    if (typeof window === 'undefined') return;

    const messages = await this.exportChatHistory(roomId);
    const blob = new Blob([JSON.stringify(messages, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `chat-history-${roomId}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Set a custom wallpaper for a chat room.
   */
  async setChatWallpaper(roomId: string, wallpaperUrl: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/rooms/${roomId}/wallpaper`,
        { wallpaperUrl },
        { headers: this.getHeaders() },
      ),
    );
  }

  /**
   * Retrieve the custom wallpaper URL for a chat room (or null if none set).
   */
  async getChatWallpaper(roomId: string): Promise<string | null> {
    const response = await firstValueFrom(
      this.http.get<{ wallpaperUrl: string | null }>(`${this.baseUrl}/rooms/${roomId}/wallpaper`, {
        headers: this.getHeaders(),
      }),
    );
    return response.wallpaperUrl;
  }

  async sendTypingIndicator(roomId: string, isTyping: boolean): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/typing`,
          {
            room_id: roomId,
            is_typing: isTyping ? 'true' : 'false',
          },
          { headers: this.getHeaders() },
        ),
      );
    } catch {
      // Silently ignore typing indicator errors -- not critical
    }
  }

  async deleteMessage(messageId: string, scope: 'self' | 'everyone' = 'self'): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/messages/${messageId}`, {
        headers: this.getHeaders(),
        body: { scope },
      }),
    );
  }

  /**
   * Deletes a message for everyone (only allowed for the sender or a room admin).
   */
  async deleteMessageForEveryone(messageId: string): Promise<void> {
    await this.deleteMessage(messageId, 'everyone');
  }

  async forwardMessage(messageId: string, roomIds: string[]): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/messages/${messageId}/forward`,
        { room_ids: roomIds },
        { headers: this.getHeaders() },
      ),
    );
  }

  /**
   * Updates the delivery status of a message (delivered / read).
   * Called by the recipient of a message.
   */
  async markMessageStatus(messageId: string, status: 'delivered' | 'read'): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/messages/${messageId}/status`,
        { status },
        { headers: this.getHeaders() },
      ),
    );
  }
}
