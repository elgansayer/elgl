import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number];

export interface MessageReaction {
  user_id: string;
  emoji: string;
}

export interface MessageReactionState {
  message_id: string;
  reactions: MessageReaction[];
}

export interface RoomReactionState {
  reactions: Record<string, MessageReaction[]>;
}

@Injectable({ providedIn: 'root' })
export class MessageReactionsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/messages`;

  async getRoomReactions(roomId: string): Promise<RoomReactionState> {
    return firstValueFrom(
      this.http.get<RoomReactionState>(
        `${this.baseUrl}/room/${encodeURIComponent(roomId)}/reactions`,
        { headers: this.authHeaders() },
      ),
    );
  }

  async setReaction(
    messageId: string,
    emoji: MessageReactionEmoji,
    active: boolean,
  ): Promise<MessageReactionState> {
    return firstValueFrom(
      this.http.put<MessageReactionState>(
        `${this.baseUrl}/${encodeURIComponent(messageId)}/reaction`,
        { emoji, active },
        { headers: this.authHeaders() },
      ),
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getAccessToken();
    if (!token) {
      throw new Error('Authentication required for message reactions');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
