import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import type { MessageReactionEmoji } from './dto/message-reaction.dto';

export interface MessageReactionRow {
  user_id: string;
  emoji: string;
}

export interface MessageReactionState {
  message_id: string;
  reactions: MessageReactionRow[];
}

@Injectable()
export class MessageReactionsService {
  constructor(
    @InjectPinoLogger(MessageReactionsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

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
    const { data: membership, error: membershipError } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      this.logger.warn('Message reaction membership lookup failed');
      throw new InternalServerErrorException('Unable to update reaction');
    }
    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

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

  private async getState(messageId: string): Promise<MessageReactionState> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('message_reactions')
      .select('user_id, emoji')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error || !Array.isArray(data)) {
      this.logger.warn('Message reaction state lookup failed');
      throw new InternalServerErrorException('Unable to load reactions');
    }

    const reactions = data.filter(
      (row: unknown): row is MessageReactionRow =>
        typeof row === 'object' &&
        row !== null &&
        'user_id' in row &&
        'emoji' in row &&
        typeof row.user_id === 'string' &&
        typeof row.emoji === 'string',
    );

    return { message_id: messageId, reactions };
  }
}
