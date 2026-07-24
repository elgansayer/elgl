import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';

export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'correction' | 'doodle';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
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
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private baseUrl = `${environment.apiUrl}/chat`;

  private readonly blockedUsers = signal<Set<string>>(new Set());

  readonly isUserBlocked = computed(() => {
    const blocked = this.blockedUsers();
    return (userId: string) => blocked.has(userId);
  });

  addBlockedUser(userId: string): void {
    this.blockedUsers.update(blocked => {
      const newSet = new Set(blocked);
      newSet.add(userId);
      return newSet;
    });
  }

  removeBlockedUser(userId: string): void {
    this.blockedUsers.update(blocked => {
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
      Authorization: `Bearer ${token ?? ''}`
    };
  }

  async sendMessage(payload: {
    room_id: string;
    message_type: 'text' | 'voice' | 'correction' | 'doodle';
    text_content?: string;
    media_url?: string;
    correction_payload?: CorrectionPayload;
  }): Promise<ChatMessage> {
    return firstValueFrom(
      this.http.post<ChatMessage>(`${this.baseUrl}/messages`, payload, { headers: this.getHeaders() })
    );
  }

  async getMessages(roomId: string, search?: string): Promise<ChatMessage[]> {
    let params = new HttpParams();
    if (search && search.trim().length > 0) {
      params = params.set('search', search.trim());
    }

    const messages = await firstValueFrom(
      this.http.get<ChatMessage[]>(`${this.baseUrl}/messages/${roomId}`, { 
        headers: this.getHeaders(), 
        params 
      })
    );

    // Filter out messages from blocked users
    const currentUser = this.authService.currentUser();
    if (currentUser?.id) {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
      if (blockedIds.length > 0) {
        return messages.filter(msg => !blockedIds.includes(msg.sender_id));
      }
    }

    return messages;
  }

  async getRooms(): Promise<ChatRoom[]> {
    return firstValueFrom(
      this.http.get<ChatRoom[]>(`${this.baseUrl}/rooms`, { headers: this.getHeaders() })
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
        context_url: window.location.href 
      }),
    });
    if (!response.ok) throw new Error('Failed to report message');
  }

  async getFavourites(): Promise<FavouriteRecord[]> {
    return firstValueFrom(
      this.http.get<FavouriteRecord[]>(`${this.baseUrl}/favourites`, { headers: this.getHeaders() })
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
          headers: this.getHeaders()
        })
      );
      return response.blocked;
    } catch (e) {
      console.error('Failed to check block status:', e);
      return false;
    }
  }
}
