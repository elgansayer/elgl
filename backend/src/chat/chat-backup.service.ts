import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './interfaces/chat-message.interface';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface BackupMessageInsert {
  room_id: string;
  sender_id: string;
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  correction_payload: Record<string, unknown> | null;
  reply_to_id: string | null;
  correction_request_payload: Record<string, unknown> | null;
  status_reply_payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at?: string;
}

@Injectable()
export class ChatBackupService {
  constructor(
    private readonly chatService: ChatService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async exportChannel(
    userId: string,
    channelId: string,
  ): Promise<ChatMessage[]> {
    return this.chatService.exportChatHistory(userId, channelId);
  }

  async importChannel(
    userId: string,
    channelId: string,
    messages: unknown[],
  ): Promise<number> {
    const supabase = this.supabaseService.getClient();

    const { data: membership, error: memberErr } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', channelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberErr || !membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const validMessages: BackupMessageInsert[] = [];

    for (const raw of messages) {
      if (!isRecord(raw)) continue;
      if (raw.room_id !== channelId) continue;

      const roomId = typeof raw.room_id === 'string' ? raw.room_id : undefined;
      const senderId =
        typeof raw.sender_id === 'string' ? raw.sender_id : undefined;
      const messageType =
        typeof raw.message_type === 'string' ? raw.message_type : undefined;
      if (!roomId || !senderId || !messageType) continue;

      const textContent =
        typeof raw.text_content === 'string' ? raw.text_content : null;
      const mediaUrl = typeof raw.media_url === 'string' ? raw.media_url : null;
      const replyToId =
        typeof raw.reply_to_id === 'string' ? raw.reply_to_id : null;

      const correctionPayload = isRecord(raw.correction_payload)
        ? raw.correction_payload
        : null;
      const correctionRequestPayload = isRecord(raw.correction_request_payload)
        ? raw.correction_request_payload
        : null;
      const statusReplyPayload = isRecord(raw.status_reply_payload)
        ? raw.status_reply_payload
        : null;

      validMessages.push({
        room_id: roomId,
        sender_id: senderId,
        message_type: messageType,
        text_content: textContent,
        media_url: mediaUrl,
        correction_payload: correctionPayload,
        reply_to_id: replyToId,
        correction_request_payload: correctionRequestPayload,
        status_reply_payload: statusReplyPayload,
        is_read: typeof raw.is_read === 'boolean' ? raw.is_read : false,
        created_at:
          typeof raw.created_at === 'string' ? raw.created_at : undefined,
      });
    }

    if (validMessages.length === 0) {
      return 0;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(validMessages)
      .select('id');

    if (error) {
      throw new BadRequestException(
        `Failed to restore messages: ${error.message}`,
      );
    }

    return data?.length ?? 0;
  }
}
