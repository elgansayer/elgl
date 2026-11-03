import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { R2GatewayError } from '../cloudflare-r2/r2.service';
import {
  DOODLE_CHAT_MEDIA_CONTENT_TYPE,
  DOODLE_CHAT_MEDIA_MAX_BYTES,
} from '../media/dto/chat-media-upload.dto';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';
import {
  ChatMediaSendOutcome,
  MetricsService,
} from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './interfaces/chat-message.interface';

type UploadedChatMessageType = 'image' | 'video' | 'video_note' | 'doodle';

interface DeliveredChatMedia {
  message: ChatMessage;
  outcome: Extract<ChatMediaSendOutcome, 'created' | 'replayed' | 'recovered'>;
}

@Injectable()
export class ChatMediaMessageService {
  private readonly logger = new Logger(ChatMediaMessageService.name);

  constructor(
    private readonly r2ObjectService: R2ObjectService,
    private readonly supabaseService: SupabaseService,
    private readonly chatService: ChatService,
    private readonly metricsService: MetricsService,
  ) {}

  async send(
    userId: string,
    dto: SendChatMediaMessageDto,
  ): Promise<ChatMessage> {
    let delivered: DeliveredChatMedia;
    try {
      delivered = await this.deliver(userId, dto);
    } catch (cause) {
      this.metricsService.recordChatMediaSend(
        dto.mediaKind,
        this.failureOutcome(cause),
      );
      throw cause;
    }
    this.metricsService.recordChatMediaSend(dto.mediaKind, delivered.outcome);
    return delivered.message;
  }

  private async deliver(
    userId: string,
    dto: SendChatMediaMessageDto,
  ): Promise<DeliveredChatMedia> {
    const messageType = this.resolveMessageType(dto);
    const mediaUrl = this.resolveOwnedMediaUrl(userId, dto);
    await this.assertRoomMembership(userId, dto.roomId);
    const existing = await this.findExisting(userId, mediaUrl);
    if (existing) {
      this.logger.log(
        {
          event: 'chat_media_send_replayed',
          mediaKind: dto.mediaKind,
          messageType,
          messageId: existing.id,
        },
        'Chat media send resolved to an existing message',
      );
      return {
        message: this.assertMatchingRetry(existing, dto, messageType),
        outcome: 'replayed',
      };
    }
    await this.assertDoodleObject(dto);

    try {
      const message = await this.chatService.sendMessage(userId, {
        room_id: dto.roomId,
        message_type: messageType,
        media_url: mediaUrl,
      });
      return { message, outcome: 'created' };
    } catch (cause) {
      // sendMessage persists before publishing to Centrifugo. If publication or
      // the response path fails after the insert, a retry must return the row
      // rather than create a second media message. The unique partial index is
      // the database-level backstop for concurrent retries.
      const raced = await this.findExisting(userId, mediaUrl);
      if (raced) {
        this.logger.warn(
          {
            event: 'chat_media_send_recovered',
            mediaKind: dto.mediaKind,
            messageType,
            messageId: raced.id,
            failure: cause instanceof Error ? cause.name : typeof cause,
          },
          'Chat media send recovered a persisted message after a failure',
        );
        return {
          message: this.assertMatchingRetry(raced, dto, messageType),
          outcome: 'recovered',
        };
      }
      throw cause;
    }
  }

  private failureOutcome(cause: unknown): ChatMediaSendOutcome {
    if (cause instanceof ForbiddenException) return 'forbidden';
    if (cause instanceof NotFoundException) return 'not_member';
    if (cause instanceof ConflictException) return 'conflict';
    if (cause instanceof ServiceUnavailableException) return 'unavailable';
    if (cause instanceof UnprocessableEntityException) return 'rejected';
    return 'failed';
  }

  private resolveMessageType(
    dto: SendChatMediaMessageDto,
  ): UploadedChatMessageType {
    if (dto.presentation === 'instant_video') {
      if (dto.mediaKind !== 'video') {
        throw new UnprocessableEntityException(
          'Instant video presentation requires a video upload',
        );
      }
      return 'video_note';
    }
    return dto.mediaKind;
  }

  private resolveOwnedMediaUrl(
    userId: string,
    dto: SendChatMediaMessageDto,
  ): string {
    const expectedPrefix = `chat-media/${userId}/${dto.mediaKind}/`;
    if (!dto.objectKey.startsWith(expectedPrefix)) {
      throw new ForbiddenException(
        'Chat media object does not belong to the authenticated user',
      );
    }
    return this.r2ObjectService.publicUrlForKey(dto.objectKey);
  }

  private async findExisting(
    userId: string,
    mediaUrl: string,
  ): Promise<ChatMessage | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_messages')
      .select('*')
      .eq('sender_id', userId)
      .eq('media_url', mediaUrl)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(
        'Unable to verify chat media delivery state',
      );
    }
    return data ?? null;
  }

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

    if (error) {
      this.logger.warn(
        { event: 'chat_media_membership_lookup_failed' },
        'Unable to verify chat media room membership',
      );
      throw new ServiceUnavailableException(
        'Unable to verify chat media room membership',
      );
    }
    if (!data) {
      throw new NotFoundException('Chat room not found');
    }
  }

  private async assertDoodleObject(
    dto: SendChatMediaMessageDto,
  ): Promise<void> {
    if (dto.mediaKind !== 'doodle') return;

    let object: Awaited<ReturnType<R2ObjectService['headObject']>>;
    try {
      object = await this.r2ObjectService.headObject(dto.objectKey);
    } catch (cause) {
      const missing = cause instanceof R2GatewayError && cause.status === 404;
      this.logger.warn(
        {
          event: missing
            ? 'chat_media_object_missing'
            : 'chat_media_object_lookup_failed',
          mediaKind: dto.mediaKind,
          failure:
            cause instanceof R2GatewayError
              ? `HTTP ${cause.status}`
              : cause instanceof Error
                ? cause.name
                : typeof cause,
        },
        missing
          ? 'Uploaded chat media object was not found'
          : 'Unable to verify uploaded chat media object',
      );
      if (missing) {
        throw new UnprocessableEntityException('Uploaded doodle was not found');
      }
      throw new ServiceUnavailableException('Unable to verify uploaded doodle');
    }

    const contentType = object.contentType
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (
      object.key !== dto.objectKey ||
      contentType !== DOODLE_CHAT_MEDIA_CONTENT_TYPE ||
      object.size < 1 ||
      object.size > DOODLE_CHAT_MEDIA_MAX_BYTES
    ) {
      this.logger.warn(
        {
          event: 'chat_media_object_rejected',
          mediaKind: dto.mediaKind,
        },
        'Uploaded chat media object did not match its policy',
      );
      throw new UnprocessableEntityException(
        'Uploaded doodle does not match the doodle media policy',
      );
    }
  }

  private assertMatchingRetry(
    message: ChatMessage,
    dto: SendChatMediaMessageDto,
    expectedMessageType: string,
  ): ChatMessage {
    if (
      message.room_id !== dto.roomId ||
      message.message_type !== expectedMessageType
    ) {
      this.logger.warn(
        {
          event: 'chat_media_send_conflict',
          mediaKind: dto.mediaKind,
          messageType: expectedMessageType,
          messageId: message.id,
        },
        'Uploaded chat media has already been used by another message',
      );
      throw new ConflictException(
        'Uploaded chat media has already been used by another message',
      );
    }
    return message;
  }
}
