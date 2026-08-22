import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';

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
const MAX_REALTIME_REACTION_ROWS = 600;

function parseReactionRows(value: unknown): MessageReaction[] | null {
  if (!Array.isArray(value) || value.length > MAX_REALTIME_REACTION_ROWS) return null;

  const rows: MessageReaction[] = [];
  for (const row of value) {
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
  return rows;
}

export function parseMessageReactionPublication(value: unknown): MessageReactionState | null {
  if (typeof value !== 'object' || value === null || !('reaction' in value)) return null;
  const reaction = value.reaction;
  if (typeof reaction !== 'object' || reaction === null) return null;
  if (!('message_id' in reaction) || !('reactions' in reaction)) return null;
  if (
    typeof reaction.message_id !== 'string' ||
    reaction.message_id.length === 0 ||
    reaction.message_id.length > 128
  ) {
    return null;
  }
  const rows = parseReactionRows(reaction.reactions);
  return rows ? { message_id: reaction.message_id, reactions: rows } : null;
}

function parseRoomReactionState(value: unknown): RoomReactionState | null {
  if (typeof value !== 'object' || value === null || !('reactions' in value)) return null;
  const reactions = value.reactions;
  if (typeof reactions !== 'object' || reactions === null || Array.isArray(reactions)) return null;

  const entries = Object.entries(reactions);
  if (entries.length > 100) return null;
  const parsed: Record<string, MessageReaction[]> = {};
  for (const [messageId, rows] of entries) {
    if (!messageId || messageId.length > 128) return null;
    const parsedRows = parseReactionRows(rows);
    if (!parsedRows) return null;
    parsed[messageId] = parsedRows;
  }
  return { reactions: parsed };
}

@Injectable({ providedIn: 'root' })
export class MessageReactionsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly centrifuge = inject(CentrifugeService);
  private readonly baseUrl = `${environment.apiUrl}/chat/messages`;
  private readonly roomState = signal<Record<string, Record<string, MessageReaction[]>>>({});
  private readonly roomLoads = new Map<string, Promise<void>>();
  private readonly roomRefCounts = new Map<string, number>();
  private readonly roomUnlisteners = new Map<string, () => void>();

  reactionsForMessage(roomId: string, messageId: string): MessageReaction[] {
    return this.roomState()[roomId]?.[messageId] ?? [];
  }

  acquireRoom(roomId: string): void {
    const count = this.roomRefCounts.get(roomId) ?? 0;
    this.roomRefCounts.set(roomId, count + 1);
    if (count > 0) return;

    const channel = `chat:${roomId}`;
    const unlisten = this.centrifuge.listen(channel, (publication) => {
      const state = parseMessageReactionPublication(publication);
      if (state) this.applyMessageState(roomId, state);
    });
    this.roomUnlisteners.set(roomId, unlisten);
    void this.ensureRoomLoaded(roomId);
  }

  releaseRoom(roomId: string): void {
    const count = this.roomRefCounts.get(roomId) ?? 0;
    if (count > 1) {
      this.roomRefCounts.set(roomId, count - 1);
      return;
    }

    this.roomRefCounts.delete(roomId);
    this.roomUnlisteners.get(roomId)?.();
    this.roomUnlisteners.delete(roomId);
  }

  async ensureRoomLoaded(roomId: string): Promise<void> {
    const existing = this.roomLoads.get(roomId);
    if (existing) return existing;

    const request = this.loadRoomReactions(roomId).finally(() => {
      if (this.roomLoads.get(roomId) === request) this.roomLoads.delete(roomId);
    });
    this.roomLoads.set(roomId, request);
    return request;
  }

  async setReaction(
    roomId: string,
    messageId: string,
    emoji: MessageReactionEmoji,
    active: boolean,
  ): Promise<MessageReactionState> {
    const raw = await firstValueFrom(
      this.http.put<unknown>(
        `${this.baseUrl}/${encodeURIComponent(messageId)}/reaction`,
        { emoji, active },
        { headers: this.authHeaders() },
      ),
    );
    const state = parseMessageReactionPublication({ reaction: raw });
    if (!state) throw new Error('Invalid message reaction response');
    this.applyMessageState(roomId, state);
    return state;
  }

  private async loadRoomReactions(roomId: string): Promise<void> {
    const raw = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/room/${encodeURIComponent(roomId)}/reactions`, {
        headers: this.authHeaders(),
      }),
    );
    const state = parseRoomReactionState(raw);
    if (!state) throw new Error('Invalid room reaction response');
    this.roomState.update((rooms) => ({ ...rooms, [roomId]: state.reactions }));
  }

  private applyMessageState(roomId: string, state: MessageReactionState): void {
    this.roomState.update((rooms) => ({
      ...rooms,
      [roomId]: {
        ...(rooms[roomId] ?? {}),
        [state.message_id]: state.reactions,
      },
    }));
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getAccessToken();
    if (!token) {
      throw new Error('Authentication required for message reactions');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
