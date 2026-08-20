import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import {
  ChatMentionEvent,
  ChatMessageEvent,
} from '../notifications/events/notification.events';
import { SafetyService } from '../safety/safety.service';
import { SpamDetectionService } from '../spam-detection/spam-detection.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { XpService } from '../xp/xp.service';
import { ChatLlmService } from './chat-llm.service';
import { ChatService } from './chat.service';
import { CentrifugoService } from './centrifugo.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendTypingDto } from './dto/send-typing.dto';
import {
  ChatMessage,
  ChatRoomRecord,
} from './interfaces/chat-message.interface';
import { ReadReceiptsService } from './read-receipts.service';
import { SystemMessageService } from './services/system-message.service';

type RoomKind = { type?: string | null; is_archived?: boolean | null };

type RoomRow = Record<string, unknown> & {
  id: string;
  type?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  subtitle?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
  is_pinned?: boolean | null;
  is_archived?: boolean | null;
  created_at?: string | null;
  wallpaper_url?: string | null;
  labels?: string[] | null;
  admin_id?: string | null;
};

@Injectable()
export class GroupAwareChatService extends ChatService {
  constructor(
    private readonly groupSupabase: SupabaseService,
    private readonly groupCentrifugo: CentrifugoService,
    @Optional() private readonly groupReceipts: ReadReceiptsService | undefined,
    private readonly groupEvents: EventEmitter2,
    private readonly groupSafety: SafetyService,
    private readonly groupLinkPreview: LinkPreviewService,
    private readonly groupSpam: SpamDetectionService,
    chatLlmService: ChatLlmService,
    systemMessageService: SystemMessageService,
    private readonly groupXp: XpService,
    usersService: UsersService,
    configService: ConfigService,
  ) {
    super(
      groupSupabase,
      groupCentrifugo,
      groupReceipts,
      groupEvents,
      groupSafety,
      groupLinkPreview,
      groupSpam,
      chatLlmService,
      systemMessageService,
      groupXp,
      usersService,
      configService,
    );
  }

  private async roomKind(roomId: string): Promise<RoomKind | null> {
    const { data, error } = await this.groupSupabase
      .getClient()
      .from('chat_rooms')
      .select('type,is_archived')
      .eq('id', roomId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load chat room: ${error.message}`);
    return data as RoomKind | null;
  }

  private async requireGroupMember(roomId: string, userId: string): Promise<void> {
    const { data, error } = await this.groupSupabase
      .getClient()
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Failed to verify chat membership: ${error.message}`);
    if (!data) throw new ForbiddenException('You are not a member of this group');
  }

  override async getRooms(currentUserId: string): Promise<ChatRoomRecord[]> {
    const client = this.groupSupabase.getClient();
    const { data: myMemberships, error: membershipError } = await client
      .from('chat_room_members')
      .select('room_id,role,is_locked')
      .eq('user_id', currentUserId);
    if (membershipError) {
      throw new Error(`Failed to load chat memberships: ${membershipError.message}`);
    }

    const visibleMemberships = (myMemberships ?? []).filter(
      (membership: { is_locked?: boolean | null }) => !membership.is_locked,
    );
    const roomIds = visibleMemberships.map(
      (membership: { room_id: string }) => membership.room_id,
    );
    if (roomIds.length === 0) return [];

    const [{ data: roomRows, error: roomError }, { data: allMembers }] =
      await Promise.all([
        client.from('chat_rooms').select('*').in('id', roomIds),
        client
          .from('chat_room_members')
          .select('room_id,user_id,role')
          .in('room_id', roomIds),
      ]);
    if (roomError) throw new Error(`Failed to load chat rooms: ${roomError.message}`);

    const blockedIds = new Set(
      await this.groupSafety.getBlockedAndBlockerIds(currentUserId),
    );
    const membersByRoom = new Map<
      string,
      Array<{ user_id: string; role?: string | null }>
    >();
    for (const member of allMembers ?? []) {
      const members = membersByRoom.get(member.room_id) ?? [];
      members.push(member);
      membersByRoom.set(member.room_id, members);
    }

    return ((roomRows ?? []) as RoomRow[])
      .filter((room) => !room.is_archived)
      .filter((room) => {
        if (room.type === 'group') return true;
        const other = (membersByRoom.get(room.id) ?? []).find(
          (member) => member.user_id !== currentUserId,
        );
        return !other || !blockedIds.has(other.user_id);
      })
      .sort((left, right) => {
        if (Boolean(left.is_pinned) !== Boolean(right.is_pinned)) {
          return left.is_pinned ? -1 : 1;
        }
        return String(left.created_at ?? '').localeCompare(
          String(right.created_at ?? ''),
        );
      })
      .map((room) => {
        const admin = (membersByRoom.get(room.id) ?? []).find(
          (member) => member.role === 'admin',
        );
        return {
          id: room.id,
          title: room.title ?? room.name ?? null,
          subtitle: room.subtitle ?? room.description ?? null,
          avatar: room.avatar ?? room.avatar_url ?? null,
          is_online: room.is_online ?? false,
          is_pinned: room.is_pinned ?? false,
          created_at: room.created_at ?? undefined,
          labels: room.labels ?? [],
          wallpaper_url: room.wallpaper_url ?? null,
          admin_id: room.admin_id ?? admin?.user_id ?? null,
          // Extra fields are intentionally retained for newer clients while the
          // legacy ChatRoomRecord contract continues to receive title/avatar.
          type: room.type ?? 'direct',
          name: room.name ?? room.title ?? null,
          description: room.description ?? null,
        } as ChatRoomRecord;
      });
  }

  override async getGroupMembers(
    roomId: string,
    currentUserId?: string,
  ): Promise<
    Array<{
      user_id: string;
      role?: string;
      user?: {
        id?: string;
        display_name?: string | null;
        avatar_url?: string | null;
      } | null;
    }>
  > {
    if (currentUserId) await this.requireGroupMember(roomId, currentUserId);
    const { data, error } = await this.groupSupabase
      .getClient()
      .from('chat_room_members')
      .select(
        'user_id,role,user:users!chat_room_members_user_id_fkey(id,display_name,avatar_url)',
      )
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
      .limit(19);
    if (error) throw new Error(`Failed to fetch group members: ${error.message}`);
    return data ?? [];
  }

  override async sendTyping(userId: string, dto: SendTypingDto): Promise<void> {
    const room = await this.roomKind(dto.room_id);
    if (room?.type === 'group') {
      if (room.is_archived) throw new NotFoundException('Group chat is archived');
      await this.requireGroupMember(dto.room_id, userId);
    }
    return super.sendTyping(userId, dto);
  }

  override async getMessages(
    roomId: string,
    search?: string,
    currentUserId?: string,
  ): Promise<ChatMessage[]> {
    const room = await this.roomKind(roomId);
    if (room?.type !== 'group') {
      return super.getMessages(roomId, search, currentUserId);
    }
    if (!currentUserId) {
      throw new ForbiddenException('Authentication is required for group chats');
    }
    if (room.is_archived) throw new NotFoundException('Group chat is archived');
    await this.requireGroupMember(roomId, currentUserId);

    const blockedIds = await this.groupSafety.getBlockedAndBlockerIds(currentUserId);
    let query = this.groupSupabase
      .getClient()
      .from('chat_messages')
      .select(
        '*, sender:users!chat_messages_sender_id_fkey(id,display_name,avatar_url)',
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (blockedIds.length > 0) {
      query = query.not('sender_id', 'in', `(${blockedIds.join(',')})`);
    }
    if (search?.trim()) {
      query = query.ilike('text_content', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load group messages: ${error.message}`);

    return ((data ?? []) as ChatMessage[]).filter((message) => {
      const raw = message as ChatMessage & { is_deleted?: boolean };
      if (raw.is_deleted || raw.deleted_for_user_ids?.includes(currentUserId)) {
        return false;
      }
      if (raw.is_view_once && raw.viewed_at) raw.media_url = undefined;
      return true;
    });
  }

  override async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const room = await this.roomKind(dto.room_id);
    if (room?.type !== 'group') return super.sendMessage(senderId, dto);
    if (room.is_archived) throw new NotFoundException('Group chat is archived');
    await this.requireGroupMember(dto.room_id, senderId);

    if (
      dto.message_type === 'text' &&
      dto.text_content &&
      this.groupSpam.isSpam(dto.text_content)
    ) {
      throw new BadRequestException(
        'Your message appears to be a duplicate or spam content.',
      );
    }

    const client = this.groupSupabase.getClient();
    const { data: savedMessage, error } = await client
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
        '*, sender:users!chat_messages_sender_id_fkey(id,display_name,avatar_url)',
      )
      .single();

    if (error || !savedMessage) {
      throw new Error(
        `Failed to save group message: ${error?.message ?? 'no message returned'}`,
      );
    }

    let messageForPublish: ChatMessage = savedMessage as ChatMessage;
    if (dto.message_type === 'text' && dto.text_content) {
      const url = dto.text_content.match(/https?:\/\/[^\s]+/)?.[0];
      if (url) {
        try {
          const linkPreview = await this.groupLinkPreview.getPreview(url);
          if (linkPreview) {
            messageForPublish = {
              ...messageForPublish,
              link_preview: linkPreview,
            };
          }
        } catch {
          // Link previews are optional and must never block sending.
        }
      }
    }

    void this.groupXp.awardXpForActivity(senderId, 'send_message');
    await this.groupCentrifugo.publish(`chat:${dto.room_id}`, {
      message: messageForPublish,
    });
    void this.groupReceipts?.setInitialSent(savedMessage.id);

    const { data: members } = await client
      .from('chat_room_members')
      .select(
        'user_id,user:users!chat_room_members_user_id_fkey(display_name)',
      )
      .eq('room_id', dto.room_id)
      .neq('user_id', senderId);

    const preview = dto.text_content?.substring(0, 120) ?? dto.message_type;
    for (const member of members ?? []) {
      this.groupEvents.emit(
        'chat.message',
        new ChatMessageEvent(
          senderId,
          member.user_id,
          dto.room_id,
          dto.message_type,
          preview,
        ),
      );
      void this.groupReceipts?.markAsDelivered(
        savedMessage.id,
        dto.room_id,
        member.user_id,
      );
    }
    this.groupEvents.emit('message.sent', { userId: senderId });

    if (dto.message_type === 'text' && dto.text_content && members) {
      const mentioned = new Set(
        [...dto.text_content.matchAll(/@([\wÀ-ɏ؀-ۿ]+)/g)].map((match) =>
          match[1].toLowerCase(),
        ),
      );
      for (const member of members as Array<{
        user_id: string;
        user?: { display_name?: string | null } | null;
      }>) {
        const displayName = member.user?.display_name?.toLowerCase();
        if (displayName && mentioned.has(displayName)) {
          this.groupEvents.emit(
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

    // Group membership is the consent boundary: do not apply direct-chat
    // first-contact message_filters or automatic away replies here.
    return messageForPublish;
  }
}
