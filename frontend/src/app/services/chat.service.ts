import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { OfflineQueueService } from './offline-queue.service';
import { HapticFeedbackService } from './haptic-feedback.service';

export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'correction' | 'doodle' | 'sticker' | 'system';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  system_event?: {
    type: string;
    [param: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  /** ID of the parent message this replies to (threaded replies) */
  reply_to_id?: string;
  /** Preview of the parent message for inline display */
  reply_preview?: {
    text_content: string;
    sender_id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
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
  created_at: string;
  admin_id?: string;
}

export interface GroupMember {
  user_id: string;
  user?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private offlineQueue = inject(OfflineQueueService);
  private hapticFeedback = inject(HapticFeedbackService);
  private baseUrl = `${environment.apiUrl}/chat`;

  // Blocked user list is loaded on demand, never in the constructor,
  // to avoid premature HTTP calls that break test environments.
  private readonly blockedUsers = signal<Set<string>>(new Set());

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
    message_type: 'text' | 'voice' | 'correction' | 'doodle' | 'sticker';
    text_content?: string;
    media_url?: string;
    correction_payload?: CorrectionPayload;
    reply_to_id?: string;
  }): Promise<ChatMessage> {
    // Check if the receiver is blocked before sending
    const currentUser = this.authService.currentUser();
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

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const queuedMsg: ChatMessage = {
        id: crypto.randomUUID(),
        room_id: payload.room_id,
        sender_id: currentUser?.id || '',
        message_type: payload.message_type,
        text_content: payload.text_content,
        media_url: payload.media_url,
        correction_payload: payload.correction_payload,
        reply_to_id: payload.reply_to_id,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      await this.offlineQueue.enqueueMessage(queuedMsg);
      this.hapticFeedback.tap();
      return queuedMsg;
    }

    const message = await firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, {
        headers: this.getHeaders(),
      }),
    );
    this.hapticFeedback.tap();
    return message;
  }

  private async syncOfflineMessages(): Promise<void> {
    try {
      const messages = await this.offlineQueue.getQueuedMessages();
      for (const msg of messages) {
        const payload = {
          room_id: msg.room_id,
          message_type: msg.message_type,
          text_content: msg.text_content,
          media_url: msg.media_url,
          correction_payload: msg.correction_payload,
          reply_to_id: msg.reply_to_id,
        };

        await firstValueFrom(
          this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, {
            headers: this.getHeaders(),
          }),
        );
        await this.offlineQueue.removeMessage(msg.id);
      }
    } catch (error) {
      console.error('Failed to sync offline messages:', error);
    }
  }

  async getMessages(roomId: string, search?: string): Promise<ChatMessage[]> {
    let params = new HttpParams();
    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }

    const messages = await firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${roomId}`, {
        headers: this.getHeaders(),
        params,
      }),
    );

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
    const rooms = await firstValueFrom(
      this.http.get<ChatRoom[]>(`${this.baseUrl}/rooms`, { headers: this.getHeaders() }),
    );

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

  async getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(
      this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`, {
        headers: this.getHeaders(),
      }),
    );
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

  async createGroup(name: string, memberIds: string[]): Promise<ChatRoom> {
    return firstValueFrom(
      this.http.post<ChatRoom>(
        `${this.baseUrl}/groups`,
        { name, memberIds },
        { headers: this.getHeaders() },
      ),
    );
  }

  async renameGroup(roomId: string, name: string): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/groups/${roomId}/rename`,
        { name },
        { headers: this.getHeaders() },
      ),
    );
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
    return firstValueFrom(
      this.http.get<GroupMember[]>(`${this.baseUrl}/groups/${roomId}/members`, {
        headers: this.getHeaders(),
      }),
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
  async translateVoiceroomText(text: string, targetLanguage: string): Promise<{ translated_text: string; detected_language: string }> {
    return firstValueFrom(
      this.http.post<{ translated_text: string; detected_language: string }>(
        `${environment.apiUrl}/chat/translate-voiceroom`,
        { text, target_language: targetLanguage },
        { headers: this.getHeaders() },
      ),
    );
  }
}
