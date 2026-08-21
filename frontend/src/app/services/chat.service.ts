import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { OfflineQueueService } from './offline-queue.service';
import { HapticFeedbackService } from './haptic-feedback.service';
import { ChatCacheService } from './chat-cache.service';
import { Router } from '@angular/router';

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
  animation_type?: string;
  animation_url?: string;
  sender_name?: string;
  receiver_name?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
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
}

export interface ReadReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  readAt: string;
}

export interface MessageReceiptStatus {
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
  admin_id?: string;
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

  async addLabel(label: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/labels`, { label }, { headers: this.getHeaders() }),
    );
    this.labels.update((labels) => [...labels, label]);
  }

  async removeLabel(label: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/labels/${encodeURIComponent(label)}`, {
        headers: this.getHeaders(),
      }),
    );
    this.labels.update((labels) => labels.filter((l) => l !== label));
  }

  async assignLabelToRoom(roomId: string, label: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/rooms/${roomId}/labels`,
        { label },
        { headers: this.getHeaders() },
      ),
    );
  }

  async removeLabelFromRoom(roomId: string, label: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/rooms/${roomId}/labels/${encodeURIComponent(label)}`, {
        headers: this.getHeaders(),
      }),
    );
  }
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private offlineQueue = inject(OfflineQueueService);
  private hapticFeedback = inject(HapticFeedbackService);
  private chatCache = inject(ChatCacheService);
  private router = inject(Router);
  private baseUrl = `${environment.apiUrl}/chat`;

  // Blocked user list is loaded on demand, never in the constructor,
  // to avoid premature HTTP calls that break test environments.
  private readonly blockedUsers = signal<Set<string>>(new Set<string>());

  /** Exposed for UI: count of messages queued offline waiting for sync. */
  readonly queuedCount = this.offlineQueue.queueSize;

  async getMessageReceipts(messageId: string): Promise<MessageReceiptStatus> {
    return firstValueFrom(
      this.http.get<MessageReceiptStatus>(`${environment.apiUrl}/chat/messages/${messageId}/receipts`),
    );
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncOfflineMessages());
    }
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

    // Offline: queue the message in IndexedDB and return immediately.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queuedMsg: ChatMessage = {
        id: crypto.randomUUID(),
        room_id: payload.room_id,
        sender_id: currentUser?.id || '',
        message_type: payload.message_type,
        text_content: payload.text_content,
        media_url: payload.media_url,
        correction_payload: payload.correction_payload,
        correction_request_payload: payload.correction_request_payload,
        reply_to_id: payload.reply_to_id,
        status_reply_payload: payload.status_reply_payload,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await this.offlineQueue.enqueueMessage(queuedMsg);
      this.hapticFeedback.tap();
      return queuedMsg;
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

    const message = await firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, {
        headers: this.getHeaders(),
      }),
    );
    this.hapticFeedback.tap();
    // Append the new message to the room's cached messages so the cache stays warm
    void this.chatCache.appendCachedMessage(payload.room_id, message);
    return message;
  }

  /** Attempt to sync all offline queued messages. Individual failures do not block the rest. */
  async syncOfflineMessages(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const token = this.authService.getAccessToken();
    if (!token) return { sent, failed };

    try {
      const messages = await this.offlineQueue.getQueuedMessages();
      for (const msg of messages) {
        const payload = {
          room_id: msg.room_id,
          message_type: msg.message_type,
          text_content: msg.text_content,
          media_url: msg.media_url,
          correction_payload: msg.correction_payload,
          correction_request_payload: msg.correction_request_payload,
          reply_to_id: msg.reply_to_id,
          status_reply_payload: msg.status_reply_payload,
        };

        try {
          await firstValueFrom(
            this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, {
              headers: this.getHeaders(),
            }),
          );
          await this.offlineQueue.removeMessage(msg.id);
          sent++;
        } catch {
          failed++;
        }
      }
    } catch (error) {
      console.error('Failed to sync offline messages:', error);
    }
    return { sent, failed };
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
            return cached.filter((msg) => !blockedIds.includes(msg.sender_id));
          }
        }
        return cached;
      }
    }

    let params = new HttpParams();
    if (hasSearch) {
      params = params.set('search', search!.trim());
    }

    const messages = await firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${roomId}`, {
        headers: this.getHeaders(),
        params,
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
        return messages.filter((msg) => !blockedIds.includes(msg.sender_id));
      }
    }

    return messages;
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

  async addFavourite(messageId: string, noteText?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/favourites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify({ message_id: messageId, note_text: noteText }),
    });
    if (!response.ok) throw new Error('Failed to add favourite');
    void this.chatCache.invalidateFavourites();
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
   * Calls GET /chat/search?term=...&roomId=...&limit=...
   */
  async searchMessages(term: string, roomId?: string, limit = 50): Promise<ChatMessage[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }
    let params = new HttpParams().set('term', term.trim()).set('limit', String(limit));
    if (roomId) {
      params = params.set('roomId', roomId);
    }
    return firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/search`, {
        headers: this.getHeaders(),
        params,
      }),
    );
  }

  async getFavourites(): Promise<FavouriteRecord[]> {
    if (!this.authService.getAccessToken()) {
      return [];
    }

    // Try cache first
    const cached = await this.chatCache.getCachedFavourites();
    if (cached) {
      return cached;
    }

    const favourites = await firstValueFrom(
      this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`, {
        headers: this.getHeaders(),
      }),
    );

    // Cache the result
    void this.chatCache.cacheFavourites(favourites);
    return favourites;
  }

  async removeFavourite(favouriteId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/favourites/${favouriteId}`, {
        headers: this.getHeaders(),
      }),
    );
    void this.chatCache.invalidateFavourites();
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
