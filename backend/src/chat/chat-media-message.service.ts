import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatMessage } from './interfaces/chat-message.interface';

@Injectable()
export class ChatMediaMessageService {
  constructor(
    private readonly r2ObjectService: R2ObjectService,
    private readonly supabaseService: SupabaseService,
    private readonly chatService: ChatService,
  ) {}

  async send(userId: string, dto: SendChatMediaMessageDto): Promise<ChatMessage> {
    const mediaUrl = this.resolveOwnedMediaUrl(userId, dto);
    const existing = await this.findExisting(userId, mediaUrl);
    if (existing) {
      return this.assertMatchingRetry(existing, dto);
    }

    try {
      return await this.chatService.sendMessage(userId, {
        room_id: dto.roomId,
        message_type: dto.mediaKind,
        media_url: mediaUrl,
      } as SendMessageDto);
    } catch (cause) {
      // sendMessage persists before publishing to Centrifugo. If publication or
      // the response path fails after the insert, a retry must return the row
      // rather than create a second media message. The unique partial index is
      // the database-level backstop for concurrent retries.
      const raced = await this.findExisting(userId, mediaUrl);
      if (raced) {
        return this.assertMatchingRetry(raced, dto);
      }
      throw cause;
    }
  }

  private resolveOwnedMediaUrl(userId: string, dto: SendChatMediaMessageDto): string {
    const expectedPrefix = `chat-media/${userId}/${dto.mediaKind}/`;
    if (!dto.objectKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException('Chat media object does not belong to the authenticated user');
    }
    return this.r2ObjectService.publicUrlForKey(dto.objectKey);
  }

  private async findExisting(userId: string, mediaUrl: string): Promise<ChatMessage | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .select('*')
      .eq('sender_id', userId)
      .eq('media_url', mediaUrl)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException('Unable to verify chat media delivery state');
    }
    return (data as ChatMessage | null) ?? null;
  }

  private assertMatchingRetry(
    message: ChatMessage,
    dto: SendChatMediaMessageDto,
  ): ChatMessage {
    if (message.room_id !== dto.roomId || message.message_type !== dto.mediaKind) {
      throw new ConflictException('Uploaded chat media has already been used by another message');
    }
    return message;
  }
}
