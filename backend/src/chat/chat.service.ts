import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { SafetyService } from '../safety/safety.service';
import { LinkPreviewService } from '../link-preview/link-preview.service';
import { LinkPreview } from '../link-preview/interfaces/link-preview.interface';
import { SpamDetectionService } from '../spam-detection/spam-detection.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { SuggestedRepliesRequestDto } from './dto/suggested-replies-request.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ReplyToStatusUpdateDto } from './dto/reply-to-status-update.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import { ChatMessageEvent } from '../notifications/events/notification.events';
import { SystemMessageService } from './services/system-message.service';
import { XpService } from '../xp/xp.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    private readonly eventEmitter: EventEmitter2,
    private readonly safetyService: SafetyService,
    private readonly linkPreviewService: LinkPreviewService,
    private readonly spamDetectionService: SpamDetectionService,
    private readonly llmProxyService: LlmProxyService,
    private readonly systemMessageService: SystemMessageService,
    private readonly xpService: XpService,
  ) {}

  generateConnectionToken(userId: string): { token: string } {
    return this.centrifugoService.generateConnectionToken(userId);
  }

  async getRooms(currentUserId: string): Promise<ChatRoomRecord[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from rooms
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const response = await supabase
      .from('chat_rooms')
      .select(
        'id, title, subtitle, avatar, is_online, is_pinned, created_at, admin_id',
      )
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });

    if (response.error || !response.data || response.data.length === 0) {
      const mockRooms = [
        {
          id: 'mock-room-1',
          title: 'Spanish Practice',
          subtitle: 'Emma: "¡Hola! ¿Cómo estás hoy?"',
          avatar: 'https://i.pravatar.cc/150?u=emma',
          is_online: true,
          is_pinned: true,
          created_at: new Date().toISOString(),
        },
        {
          id: 'mock-room-2',
          title: 'Language Exchange - JP/EN',
          subtitle: 'Kenji: "Thanks for the help!"',
          avatar: 'https://i.pravatar.cc/150?u=kenji',
          is_online: false,
          is_pinned: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ] as ChatRoomRecord[];

      // Filter out blocked users from mock data
      if (blockedIds.length > 0) {
        return mockRooms.filter((room) => !blockedIds.includes(room.id));
      }
      return mockRooms;
    }

    const rooms = response.data as ChatRoomRecord[];

    // Filter out rooms where the other participant is blocked
    if (blockedIds.length > 0) {
      // Get room members for all rooms
      const roomIds = rooms.map((r) => r.id);
      const { data: members } = await supabase
        .from('chat_room_members')
        .select('room_id, user_id')
        .in('room_id', roomIds)
        .neq('user_id', currentUserId);

      if (members) {
        const memberMap = new Map<string, string>();
        (members as { room_id: string; user_id: string }[]).forEach((m) => {
          memberMap.set(m.room_id, m.user_id);
        });

        return rooms.filter((room) => {
          const otherUserId = memberMap.get(room.id);
          return otherUserId ? !blockedIds.includes(otherUserId) : true;
        });
      }
    }

    return rooms;
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    // Get room members to check if any are blocked
    const { data: roomMembers } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', dto.room_id)
      .neq('user_id', senderId);

    if (roomMembers && roomMembers.length > 0) {
      const receiverId = (roomMembers as { user_id: string }[])[0].user_id;
      // Check if the receiver has blocked the sender
      const receiverBlockedIds =
        await this.safetyService.getBlockedAndBlockerIds(receiverId);
      if (receiverBlockedIds.includes(senderId)) {
        throw new Error('You cannot send messages to this user.');
      }
      // Check if the sender has blocked the receiver
      const senderBlockedIds =
        await this.safetyService.getBlockedAndBlockerIds(senderId);
      if (senderBlockedIds.includes(receiverId)) {
        throw new Error('You cannot send messages to this user.');
      }
    }

    // Spam detection for text messages
    if (dto.message_type === 'text' && dto.text_content) {
      const isSpam = this.spamDetectionService.isSpam(dto.text_content);
      if (isSpam) {
        throw new BadRequestException(
          'Your message appears to be a duplicate or spam content.',
        );
      }
    }

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
      })
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (insertResponse.error || !insertResponse.data) {
      const msg = insertResponse.error?.message ?? 'Unknown error';
      throw new Error(`Failed to save message: ${msg}`);
    }

    const savedMessage = insertResponse.data as ChatMessage;

    // Award XP for sending a message
    void this.xpService.awardXpForActivity(senderId, 'send_message');

    // ---------- Link preview scraping ----------
    let linkPreview: LinkPreview | null = null;
    try {
      if (dto.message_type === 'text' && dto.text_content) {
        const urlMatch = dto.text_content.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          linkPreview = await this.linkPreviewService.getPreview(urlMatch[0]);
        }
      }
    } catch {
      // ignore any error; just continue without preview
    }

    // ---------- Auto‑generate explanation for correction if missing ----------
    let messageForPublish: ChatMessage = linkPreview
      ? { ...savedMessage, link_preview: linkPreview }
      : savedMessage;

    if (
      savedMessage.correction_payload &&
      !(savedMessage.correction_payload as Record<string, unknown>).explanation
    ) {
      const correctionPayload = savedMessage.correction_payload as Record<
        string,
        unknown
      >;
      const originalText = correctionPayload.original as string | undefined;
      const correctText = correctionPayload.corrected as string | undefined;

      if (originalText && correctText) {
        const prompt = `Explain simply why the following sentence was corrected.\nOriginal: "${originalText}"\nCorrected: "${correctText}"\nProvide a short explanation.`;
        try {
          const { response } = await this.llmProxyService.proxyMessage(prompt);
          if (response && response.trim().length > 0) {
            const updatedPayload = {
              ...correctionPayload,
              explanation: response.trim(),
            };
            const { error: updateError } = await this.supabaseService
              .getClient()
              .from('chat_messages')
              .update({ correction_payload: updatedPayload })
              .eq('id', savedMessage.id);

            if (!updateError) {
              messageForPublish = {
                ...messageForPublish,
                correction_payload: updatedPayload,
              } as ChatMessage;
            }
          }
        } catch {
          // Explanation generation failed; serve the message without it
        }
      }
    }

    // Publish to Centrifugo channel (with preview and possibly a generated explanation)
    await this.centrifugoService.publish(`chat:${dto.room_id}`, {
      message: messageForPublish,
    });

    // Emit push notification event
    if (roomMembers && roomMembers.length > 0) {
      const receiverId = (roomMembers as { user_id: string }[])[0].user_id;
      const preview = dto.text_content
        ? dto.text_content.substring(0, 120)
        : dto.message_type === 'voice'
          ? '🎤 Voice message'
          : dto.message_type === 'correction'
            ? '📝 Correction'
            : dto.message_type === 'doodle'
              ? '🎨 Doodle'
              : dto.message_type === 'correction_request'
                ? '✏️ Correction request'
                : '';

      this.eventEmitter.emit(
        'chat.message',

        new ChatMessageEvent(
          senderId,
          receiverId,
          dto.room_id,
          dto.message_type,
          preview,
        ),
      );
    }

    return messageForPublish;
  }

  async getMessages(
    roomId: string,
    search?: string,
    currentUserId?: string,
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from messages
    const blockedIds = currentUserId
      ? await this.safetyService.getBlockedAndBlockerIds(currentUserId)
      : [];

    let query = supabase
      .from('chat_messages')
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);

    // Exclude messages from blocked users
    if (blockedIds.length > 0) {
      query = query.not('sender_id', 'in', blockedIds);
    }

    if (search && search.trim().length > 0) {
      query = query.ilike('text_content', `%${search.trim()}%`);
    }

    const response = await query;
    if (response.error || !response.data || response.data.length === 0) {
      const mockMessages = [
        {
          id: 'mock-msg-1',
          room_id: roomId,
          sender_id: 'mock-user-1',
          message_type: 'text',
          text_content: 'Hey! I would love to practice languages with you.',
          media_url: undefined,
          correction_payload: undefined,
          is_read: true,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          sender: {
            id: 'mock-user-1',
            display_name: 'Emma',
            avatar_url: 'https://i.pravatar.cc/150?u=emma',
          },
        },
        {
          id: 'mock-msg-2',
          room_id: roomId,
          sender_id: 'me',
          message_type: 'text',
          text_content: 'Hi Emma! That sounds great.',
          media_url: undefined,
          correction_payload: undefined,
          is_read: true,
          created_at: new Date().toISOString(),
          sender: { id: 'me', display_name: 'Me', avatar_url: null },
        },
      ] as ChatMessage[];

      // Filter out blocked users from mock data
      if (blockedIds.length > 0) {
        return mockMessages.filter(
          (msg) => !blockedIds.includes(msg.sender_id),
        );
      }
      return mockMessages;
    }
    return response.data as ChatMessage[];
  }

  async addFavourite(userId: string, dto: AddFavouriteDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get the message to favourite
    const messageResponse = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', dto.message_id)
      .single();

    if (messageResponse.error || !messageResponse.data) {
      throw new Error('Message not found');
    }

    const message: ChatMessage = messageResponse.data as ChatMessage;

    // Store the favourite
    const { error } = await supabase.from('favourites').insert({
      user_id: userId,
      item_type: 'message',
      item_payload: message,
      notes: dto.note_text || null,
    });

    if (error) {
      throw new Error('Failed to add favourite');
    }
  }

  async getFavourites(userId: string): Promise<FavouriteRecord[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (response.error || !response.data) {
      return [];
    }
    return response.data as FavouriteRecord[];
  }

  async getSuggestedReplies(
    userId: string,
    dto: SuggestedRepliesRequestDto,
  ): Promise<{ suggestions: string[] }> {
    // Use the LLM proxy to generate context-aware suggestions
    const recentMessages = dto.recent_messages ?? [];
    const contextMessages = recentMessages.slice(-10);
    if (contextMessages.length === 0) {
      // fallback to static suggestions if no context is provided
      return {
        suggestions: [
          'Sure, let’s talk about travel.',
          'Could you help me with my pronunciation?',
          'I enjoyed that conversation.',
        ],
      };
    }
    const contextLines = contextMessages
      .map((m) => `${m.sender_id}: ${m.text}`)
      .join('\n');
    const prompt = `Based on this conversation:\n${contextLines}\n\nGenerate 3 suggested replies that the user could send next. Format each reply on a separate line, without numbers.`;
    try {
      const { response } = await this.llmProxyService.proxyMessage(prompt);
      const lines = response
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const suggestions = lines.slice(0, 3);
      if (suggestions.length === 0) {
        throw new Error('Empty response from LLM proxy');
      }
      return { suggestions };
    } catch (error) {
      console.error(
        'Failed to generate suggestions, using fallback:',
        (error as Error).message,
      );
      // fallback to static suggestions
      return {
        suggestions: [
          'Sure, let’s talk about travel.',
          'Could you help me with my pronunciation?',
          'I enjoyed that conversation.',
        ],
      };
    }
  }

  async createGroup(
    creatorId: string,
    name: string,
    memberIds: string[],
  ): Promise<ChatRoomRecord> {
    if (memberIds.length > 49) {
      throw new Error('Group cannot exceed 50 members');
    }

    const supabase = this.supabaseService.getClient();

    // Insert room
    const response = await supabase
      .from('chat_rooms')
      .insert({
        title: name,
        is_online: true,
        is_pinned: false,
        admin_id: creatorId,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error('Failed to create group');
    }

    const room = response.data as ChatRoomRecord;

    // Insert members
    const allMembers = [...new Set([creatorId, ...memberIds])];
    const membersData = allMembers.map((id) => ({
      room_id: room.id,
      user_id: id,
    }));

    const { error: membersError } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (membersError) {
      throw new Error('Failed to add members to group');
    }

    return room;
  }

  private async verifyAdmin(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('admin_id')
      .eq('id', roomId)
      .single();

    if (!room || room.admin_id !== userId) {
      throw new ForbiddenException('Only group admins can perform this action');
    }
  }

  async renameGroup(
    userId: string,
    roomId: string,
    newName: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('chat_rooms')
      .update({ title: newName })
      .eq('id', roomId);

    if (error) throw new Error('Failed to rename group');

    await this.systemMessageService.publishToRoom(roomId, 'groupRenamed', {
      name: newName,
    });
  }

  async addGroupMembers(
    userId: string,
    roomId: string,
    memberIds: string[],
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const membersData = memberIds.map((id) => ({
      room_id: roomId,
      user_id: id,
    }));

    const { error } = await supabase
      .from('chat_room_members')
      .insert(membersData);

    if (error) throw new Error('Failed to add members');

    await this.systemMessageService.publishToRoom(roomId, 'memberAdded', {
      count: memberIds.length,
    });
  }

  async removeGroupMember(
    userId: string,
    roomId: string,
    memberId: string,
  ): Promise<void> {
    await this.verifyAdmin(userId, roomId);
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .match({ room_id: roomId, user_id: memberId });

    if (error) throw new Error('Failed to remove member');

    await this.systemMessageService.publishToRoom(roomId, 'memberRemoved', {});
  }

  async getGroupMembers(roomId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_room_members')
      .select(
        `
        user_id,
        user:users!chat_room_members_user_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .eq('room_id', roomId);

    if (error) throw new Error('Failed to fetch group members');
    return data || [];
  }

  async replyToStatusUpdate(
    userId: string,
    dto: ReplyToStatusUpdateDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    // Determine deterministic room id
    const ids = [userId, dto.target_user_id].sort();
    const roomId = `chat_${ids.join('_')}`;

    // Check if room exists
    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('id', roomId)
      .maybeSingle();

    if (!existingRoom) {
      // Create room
      const { error: roomError } = await supabase.from('chat_rooms').insert({
        id: roomId,
        title: '',
        subtitle: '',
        avatar: '',
        is_online: false,
        is_pinned: false,
      });

      if (roomError) {
        throw new Error(`Failed to create room: ${roomError.message}`);
      }

      // Add both members
      const members = ids.map((uid) => ({
        room_id: roomId,
        user_id: uid,
      }));
      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(members);
      if (memberError) {
        throw new Error(`Failed to add room members: ${memberError.message}`);
      }
    }

    // Reuse sendMessage logic
    const msgDto: SendMessageDto = {
      room_id: roomId,
      message_type: 'status_reply',
      text_content: undefined,
      media_url: undefined,
      correction_payload: undefined,
      reply_to_id: undefined,
      correction_request_payload: undefined,
      status_reply_payload: {
        status_update_id: dto.status_update_id,
        status_text: dto.status_text,
      },
    };

    return this.sendMessage(userId, msgDto);
  }

  async llmProxy(
    userId: string,
    messageText: string,
  ): Promise<{ response: string }> {
    const result = await this.llmProxyService.proxyMessage(messageText);
    return { response: result.response };
  }
}
