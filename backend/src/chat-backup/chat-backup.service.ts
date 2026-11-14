import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ChatBackupMessageDto,
  MAX_IMPORT_MESSAGES,
  MAX_IMPORT_PAYLOAD_BYTES,
} from './dto/import-chat-backup.dto';

export interface ChatBackupMessage {
  message_type: string;
  text_content: string | null;
  media_url: string | null;
  correction_payload: Record<string, unknown> | null;
  sender_id: string;
  created_at: string;
}

export interface ChatBackupDocument {
  room_id: string;
  exported_at: string;
  messages: ChatBackupMessage[];
}

@Injectable()
export class ChatBackupService {
  private readonly logger = new Logger(ChatBackupService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async assertRoomMembership(
    userId: string,
    roomId: string,
  ): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException('You are not a member of this chat room');
    }
  }

  async exportRoomBackup(
    userId: string,
    roomId: string,
  ): Promise<ChatBackupDocument> {
    await this.assertRoomMembership(userId, roomId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .select(
        'message_type, text_content, media_url, correction_payload, sender_id, created_at',
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Export failed for room ${roomId}: ${error.message}`);
      throw new Error('Failed to export chat backup');
    }

    return {
      room_id: roomId,
      exported_at: new Date().toISOString(),
      messages: (data ?? []) as ChatBackupMessage[],
    };
  }

  async importRoomBackup(
    userId: string,
    roomId: string,
    messages: ChatBackupMessageDto[],
  ): Promise<number> {
    await this.assertRoomMembership(userId, roomId);

    if (messages.length === 0) {
      throw new BadRequestException('messages array is required');
    }

    if (messages.length > MAX_IMPORT_MESSAGES) {
      throw new BadRequestException(
        `messages must contain at most ${MAX_IMPORT_MESSAGES} entries`,
      );
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
    if (payloadBytes > MAX_IMPORT_PAYLOAD_BYTES) {
      throw new BadRequestException(
        `Import payload exceeds ${MAX_IMPORT_PAYLOAD_BYTES} bytes`,
      );
    }

    // Imported rows are always attributed to the caller: a backup document
    // cannot forge another member's messages.
    const rows = messages.map((message) => ({
      room_id: roomId,
      sender_id: userId,
      message_type: message.message_type ?? 'text',
      text_content: message.text_content ?? null,
      media_url: message.media_url ?? null,
      correction_payload: message.correction_payload ?? null,
      created_at: message.created_at ?? new Date().toISOString(),
    }));

    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .insert(rows)
      .select('id');

    if (error) {
      this.logger.error(`Import failed for room ${roomId}: ${error.message}`);
      throw new Error('Failed to import chat backup');
    }

    return data?.length ?? 0;
  }
}
