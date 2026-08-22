import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏'] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number];

export interface MessageReaction {
  user_id: string;
  emoji: MessageReactionEmoji;
}

export interface MessageReactionState {
  message_id: string;
  reactions: MessageReaction[];
}

export interface RoomReactionState {
  reactions: Record<string, MessageReaction[]>;
}

const SUPPORTED_REACTION_EMOJIS = new Set<string>(MESSAGE_REACTION_EMOJIS);

export function parseMessageReactionPublication(value: unknown): MessageReactionState | null {
  if (typeof value !== 'object' || value === null || !('reaction' in value)) return null;
  const reaction = value.reaction;
  if (typeof reaction !== 'object' || reaction === null) return null;
  if (!('message_id' in reaction) || !('reactions' in reaction)) return null;
  if (typeof reaction.message_id !== 'string' || reaction.message_id.length > 128) return null;
  if (!Array.isArray(reaction.reactions) || reaction.reactions.length > 600) return null;

  const rows: MessageReaction[] = [];
  for (const row of reaction.reactions) {
    if (
      typeof row !== 'object' ||
      row === null ||
      !('user_id' in row) ||
      !('emoji' in row) ||
      typeof row.user_id !== 'string' ||
      row.user_id.length === 0 ||
      row.user_id.length > 128 ||
      typeof row.emoji !== 'string' ||
      !SUPPORTED_REACTION_EMOJIS.has(row.emoji)
    ) {
      return null;
    }
    rows.push({ user_id: row.user_id, emoji: row.emoji as MessageReactionEmoji });
  }

  return { message_id: reaction.message_id, reactions: rows };
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
