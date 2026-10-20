import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { SpamDetectionService } from '../spam-detection/spam-detection.service';
import { XpService } from '../xp/xp.service';
import { UsersService } from '../users/users.service';
import { ChatService } from './chat.service';
import { CentrifugoService } from './centrifugo.service';
import { ReadReceiptsService } from './read-receipts.service';
import { ChatLlmService } from './chat-llm.service';
import { SystemMessageService } from './services/system-message.service';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatMessage,
  ChatRoomRecord,
} from './interfaces/chat-message.interface';
import {
  ChatMessageEvent,
  ChatMentionEvent,
} from '../notifications/events/notification.events';

/**
 * Security-preserving adapter around the long-lived ChatService.
 *
 * Group chats share the same message transport as direct chats, but direct-only
 * first-message filters/away replies must not be applied to an arbitrary group
 * member. This adapter also closes the historical room-IDOR on generic room
 * reads while keeping the existing ChatService API stable for all controllers.
 */
@Injectable()
export class SecureChatService extends ChatService {
  constructor(
    private readonly secureSupabase: SupabaseService,
    private readonly secureCentrifugo: CentrifugoService,
    @Optional()
    private readonly secureReadReceipts: ReadReceiptsService | undefined,
    private readonly secureEvents: EventEmitter2,
    private readonly secureSafety: SafetyService,
    private readonly secureLinkPreview: LinkPreviewService,
    private readonly secureSpam: SpamDetectionService,
    chatLlmService: ChatLlmService,
    systemMessageService: SystemMessageService,
    private readonly secureXp: XpService,
    usersService: UsersService,
    configService: ConfigService,
  ) {
    super(
      secureSupabase,
      secureCentrifugo,
      secureReadReceipts,
      secureEvents,
      secureSafety,
      secureLinkPreview,
      secureSpam,
      chatLlmService,
      systemMessageService,
      secureXp,
      usersService,
      configService,
    );
  }

  private async requireMembership(userId: string, roomId: string): Promise<void> {
    const { data, error } = await this.secureSupabase
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

  async getRooms(currentUserId: string): Promise<ChatRoomRecord[]> {
    const { data: memberships, error } = await this.secureSupabase
      .getClient()
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', currentUserId);

    if (error || !memberships || memberships.length === 0) return [];
    const allowed = new Set(memberships.map((row: { room_id: string }) => row.room_id));
    const rooms = await super.getRooms(currentUserId);
    return rooms.filter((room) => allowed.has(room.id));
  }

  async getMessages(
    roomId: string,
    search?: string,
    currentUserId?: string,
  ): Promise<ChatMessage[]> {
    if (!currentUserId) {
      throw new ForbiddenException('Authenticated room membership is required');
    }
    await this.requireMembership(currentUserId, roomId);
    return super.getMessages(roomId, search, currentUserId);
  }

  async getGroupMembers(roomId: string, currentUserId?: string): Promise<any[]> {
    if (currentUserId) await this.requireMembership(currentUserId, roomId);
    return super.getGroupMembers(roomId, currentUserId);
  }

  async sendMessage(senderId: string, dto: SendMessageDto): Promise<ChatMessage> {
    await this.requireMembership(senderId, dto.room_id);

    const supabase = this.secureSupabase.getClient();
    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .select('type, is_deleted')
      .eq('id', dto.room_id)
      .maybeSingle();

    if (roomError || !room || room.is_deleted) {
      throw new ForbiddenException('This chat room is unavailable');
    }

    if (room.type !== 'group') {
      return super.sendMessage(senderId, dto);
    }

    // Message filters and automatic away replies are direct-conversation
    // concepts. Group messages instead fan out to every current member.
    if (
      dto.message_type === 'text' &&
      dto.text_content &&
      this.secureSpam.isSpam(dto.text_content)
    ) {
      throw new BadRequestException(
        'Your message appears to be a duplicate or spam content.',
      );
    }

    const { data: members, error: memberError } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.room_id);
    if (memberError || !members) {
      throw new ForbiddenException('Unable to resolve group membership');
    }

    const otherMemberIds = (members as { user_id: string }[])
      .map((member) => member.user_id)
      .filter((memberId) => memberId !== senderId);

    const insertResponse = await supabase
      .from('chat_messages')
      .insert({
        room_id: dto.room_id,
        sender_id: senderId,
        message_type: dto.message_type,
        text_content: dto.text_content ?? null,
        media_url: dto.media_url ?? null,
        correction_payload: dto.correction_payload ?? null,
        reply_to_id: dto.reply_to_id ?? null,
        correction_request_payload: dto.correction_request_payload ?? null,
        status_reply_payload: dto.status_reply_payload ?? null,
        is_view_once: dto.message_type === 'view_once_media',
        delivery_status: 'sent',
      })
      .select(
        `*, sender:users!chat_messages_sender_id_fkey (id, display_name, avatar_url)`,
      )
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new BadRequestException(
        insertResponse.error?.message ?? 'Failed to save group message',
      );
    }

    let message: ChatMessage = insertResponse.data as ChatMessage;
    if (dto.message_type === 'text' && dto.text_content) {
      try {
        const url = dto.text_content.match(/https?:\/\/[^\s]+/)?.[0];
        if (url) {
          const linkPreview = await this.secureLinkPreview.getPreview(url);
          if (linkPreview) message = { ...message, link_preview: linkPreview };
        }
      } catch {
        // Link previews are enrichment only and must never block a group send.
      }
    }

    void this.secureXp.awardXpForActivity(senderId, 'send_message');
    await this.secureCentrifugo.publish(`chat:${dto.room_id}`, { message });

    const preview = dto.text_content?.slice(0, 120) ?? dto.message_type;
    for (const receiverId of otherMemberIds) {
      this.secureEvents.emit(
        'chat.message',
        new ChatMessageEvent(
          senderId,
          receiverId,
          dto.room_id,
          dto.message_type,
          preview,
        ),
      );
      void this.secureReadReceipts?.markAsDelivered(
        message.id,
        dto.room_id,
        receiverId,
      );
    }
    void this.secureReadReceipts?.setInitialSent(message.id);
    this.secureEvents.emit('message.sent', { userId: senderId });

    if (dto.message_type === 'text' && dto.text_content) {
      const mentionedNames = [
        ...dto.text_content.matchAll(/@([\wÀ-ɏ؀-ۿ]+)/g),
      ].map((match) => match[1]);
      if (mentionedNames.length > 0) {
        const groupMembers = (await super.getGroupMembers(dto.room_id)) as Array<{
          user_id: string;
          user?: { display_name?: string };
        }>;
        for (const member of groupMembers) {
          if (
            member.user_id !== senderId &&
            member.user?.display_name &&
            mentionedNames.includes(member.user.display_name)
          ) {
            this.secureEvents.emit(
              'chat.mention',
              new ChatMentionEvent(
                senderId,
                member.user_id,
                dto.room_id,
                preview,
              ),
            );
          }
        }
      }
    }

    return message;
  }
}
