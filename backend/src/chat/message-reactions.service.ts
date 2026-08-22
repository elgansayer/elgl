import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import {
  MESSAGE_REACTION_EMOJIS,
  type MessageReactionEmoji,
} from './dto/message-reaction.dto';

export interface MessageReactionRow {
  user_id: string;
  emoji: string;
}

interface StoredMessageReactionRow extends MessageReactionRow {
  message_id: string;
}

export interface MessageReactionState {
  message_id: string;
  reactions: MessageReactionRow[];
}

export interface RoomReactionState {
  reactions: Record<string, MessageReactionRow[]>;
}

@Injectable()
export class MessageReactionsService {
  private static readonly ROOM_MESSAGE_LIMIT = 100;

  constructor(
    @InjectPinoLogger(MessageReactionsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  async getRoomReactions(
    userId: string,
    roomId: string,
  ): Promise<RoomReactionState> {
    const supabase = this.supabaseService.getClient();
    await this.assertMembership(userId, roomId, 'load');

    const { data: messages, error: messageError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(MessageReactionsService.ROOM_MESSAGE_LIMIT);

    if (messageError || !Array.isArray(messages)) {
      this.logger.warn('Room reaction message lookup failed');
      throw new InternalServerErrorException('Unable to load reactions');
    }

    const messageIds = messages
      .map((row: unknown) =>
        typeof row === 'object' &&
        row !== null &&
        'id' in row &&
        typeof row.id === 'string'
          ? row.id
          : null,
      )
      .filter((id): id is string => id !== null);

    if (messageIds.length === 0) {
      return { reactions: {} };
    }

    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds)
      .order('created_at', { ascending: true });

    if (error || !Array.isArray(data)) {
      this.logger.warn('Room reaction state lookup failed');
      throw new InternalServerErrorException('Unable to load reactions');
    }

    const grouped: Record<string, MessageReactionRow[]> = {};
    for (const row of data) {
      if (!this.isStoredReaction(row)) continue;
      (grouped[row.message_id] ??= []).push({
        user_id: row.user_id,
        emoji: row.emoji,
      });
    }

    return { reactions: grouped };
  }

  async setReaction(
    userId: string,
    messageId: string,
    emoji: MessageReactionEmoji,
    active: boolean,
  ): Promise<MessageReactionState> {
    const supabase = this.supabaseService.getClient();
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, room_id, is_deleted')
      .eq('id', messageId)
      .single();

    if (messageError || !message || message.is_deleted) {
      throw new NotFoundException('Message not found');
    }

    const roomId = String(message.room_id);
    await this.assertMembership(userId, roomId, 'update');

    if (active) {
      const { error } = await supabase.from('message_reactions').upsert(
        {
          message_id: messageId,
          user_id: userId,
          emoji,
        },
        {
          onConflict: 'message_id,user_id,emoji',
          ignoreDuplicates: true,
        },
      );
      if (error) {
        this.logger.warn('Message reaction insert failed');
        throw new InternalServerErrorException('Unable to update reaction');
      }
    } else {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);
      if (error) {
        this.logger.warn('Message reaction delete failed');
        throw new InternalServerErrorException('Unable to update reaction');
      }
    }

    const state = await this.getState(messageId);

    try {
      await this.centrifugoService.publish(`chat:${roomId}`, {
        reaction: state,
      });
    } catch {
      // Persistence is authoritative. A missed realtime event is recovered on reload.
      this.logger.warn('Message reaction realtime publish failed');
    }

    return state;
  }

  private async assertMembership(
    userId: string,
    roomId: string,
    operation: 'load' | 'update',
  ): Promise<void> {
    const { data: membership, error: membershipError } = await this.supabaseService
      .getClient()
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      this.logger.warn(`Message reaction membership ${operation} lookup failed`);
      throw new InternalServerErrorException(
        `Unable to ${operation} reactions`,
      );
    }
    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }

  private async getState(messageId: string): Promise<MessageReactionState> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error || !Array.isArray(data)) {
      this.logger.warn('Message reaction state lookup failed');
      throw new InternalServerErrorException('Unable to load reactions');
    }

    const reactions = data
      .filter((row: unknown): row is StoredMessageReactionRow =>
        this.isStoredReaction(row),
      )
      .map(({ user_id, emoji }) => ({ user_id, emoji }));

    return { message_id: messageId, reactions };
  }

  private isStoredReaction(value: unknown): value is StoredMessageReactionRow {
    return (
      typeof value === 'object' &&
      value !== null &&
      'message_id' in value &&
      'user_id' in value &&
      'emoji' in value &&
      typeof value.message_id === 'string' &&
      typeof value.user_id === 'string' &&
      typeof value.emoji === 'string' &&
      (MESSAGE_REACTION_EMOJIS as readonly string[]).includes(value.emoji)
    );
  }
}
