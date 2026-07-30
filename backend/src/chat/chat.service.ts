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
import { LockChatDto } from './dto/lock-chat.dto';
import { SetWallpaperDto } from './dto/set-wallpaper.dto';

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
        'id, title, subtitle, avatar, is_online, is_pinned, created_at, admin_id, wallpaper_url, labels',
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
          wallpaper_url: null,
          labels: [],
        },
        {
          id: 'mock-room-2',
          title: 'Language Exchange - JP/EN',
          subtitle: 'Kenji: "Thanks for the help!"',
          avatar: 'https://i.pravatar.cc/150?u=kenji',
          is_online: false,
          is_pinned: false,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          wallpaper_url: null,
          labels: [],
        },
      ] as ChatRoomRecord[];

      // Filter out blocked users from mock data
      if (blockedIds.length > 0) {
        return mockRooms.filter((room) => !blockedIds.includes(room.id));
      }
      return mockRooms;
    }

    let rooms = response.data as ChatRoomRecord[];

    // Fetch locked chat room ids for the current user
    const lockedRowsResponse = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', currentUserId)
      .eq('is_locked', true);

    const lockedSet = new Set<string>(
      (lockedRowsResponse.data ?? []).map((r: any) => r.room_id),
    );

    // Annotate rooms with is_locked flag
    rooms = rooms.map((r) => ({
      ...r,
      is_locked: lockedSet.has(r.id),
    }));

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
        is_view_once: dto.message_type === 'view_once_media' ? true : false,
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
    const messages = response.data as ChatMessage[];

    // Exclude media_url for view-once media that has already been viewed
    for (const msg of messages) {
      if (msg.is_view_once && msg.viewed_at) {
        msg.media_url = undefined;
      }
    }

    return messages;
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
        labels: [],
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

  // ---- Chat Lock methods ----

  async lockChat(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .update({ is_locked: true })
      .match({ user_id: userId, room_id: roomId });

    if (error) {
      throw new Error(`Failed to lock chat: ${error.message}`);
    }
  }

  async unlockChat(userId: string, roomId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('chat_room_members')
      .update({ is_locked: false })
      .match({ user_id: userId, room_id: roomId });

    if (error) {
      throw new Error(`Failed to unlock chat: ${error.message}`);
    }
  }

  async getLockedChats(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .eq('is_locked', true);

    if (error) {
      throw new Error(`Failed to get locked chats: ${error.message}`);
    }

    return (data ?? []).map((row: any) => row.room_id);
  }

  async setWallpaper(
    userId: string,
    roomId: string,
    dto: SetWallpaperDto,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify user is a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const { error } = await supabase
      .from('chat_rooms')
      .update({ wallpaper_url: dto.wallpaperUrl })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to set wallpaper: ${error.message}`);
    }
  }

  async getWallpaper(roomId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('chat_rooms')
      .select('wallpaper_url')
      .eq('id', roomId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.wallpaper_url ?? null;
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

  async correctMessage(
    userId: string,
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    const { data: originalMsg, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('room_id, text_content, sender_id, message_type')
      .eq('id', messageId)
      .single();

    if (fetchErr || !originalMsg) {
      throw new Error('Original message not found');
    }

    if ((originalMsg as any).message_type !== 'text') {
      throw new BadRequestException('Only text messages can be corrected');
    }

    const sendDto: SendMessageDto = {
      room_id: (originalMsg as any).room_id,
      message_type: 'correction',
      text_content: undefined,
      media_url: undefined,
      correction_payload: {
        original: (originalMsg as any).text_content ?? '',
        corrected: correctedText,
        explanation: explanation ?? undefined,
      },
      reply_to_id: messageId,
      correction_request_payload: undefined,
      status_reply_payload: undefined,
    };

    return await this.sendMessage(userId, sendDto);
  }

  async fixMessage(
    userId: string,
    messageId: string,
    correctedText: string,
    explanation?: string,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();

    const { data: originalMsg, error: fetchErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !originalMsg) {
      throw new Error('Message not found');
    }

    if (originalMsg.message_type !== 'text') {
      throw new BadRequestException('Only text messages can be fixed');
    }

    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', originalMsg.room_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    if (originalMsg.sender_id === userId) {
      throw new ForbiddenException('You cannot fix your own message');
    }

    const currentPayload = originalMsg.correction_payload as Record<
      string,
      unknown
    > | null;
    const updatedPayload = {
      original: currentPayload?.original ?? originalMsg.text_content ?? '',
      corrected: correctedText,
      explanation: explanation ?? currentPayload?.explanation ?? undefined,
    };

    const { data: updatedMsg, error: updateErr } = await supabase
      .from('chat_messages')
      .update({
        text_content: correctedText,
        correction_payload: updatedPayload,
      })
      .eq('id', messageId)
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

    if (updateErr || !updatedMsg) {
      throw new Error(
        `Failed to fix message: ${updateErr?.message ?? 'Unknown error'}`,
      );
    }

    await this.centrifugoService.publish(`chat:${originalMsg.room_id}`, {
      message: updatedMsg,
    });

    return updatedMsg as ChatMessage;
  }

  async viewMessageMedia(userId: string, messageId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Fetch message with media
    const { data: msg, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError || !msg) {
      throw new Error('Message not found');
    }

    if (!msg.is_view_once || msg.viewed_at) {
      // Already viewed or not a view-once message; nothing to do
      return;
    }

    // Verify the user is a member of the room
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', msg.room_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      throw new Error('Access denied');
    }

    // Mark as viewed
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', messageId);

    if (updateError) {
      throw new Error('Failed to mark message as viewed');
    }

    // For future releases, delete the actual media from storage here
    // e.g., await this.viewOnceMediaService.deleteMedia(msg.media_url);
  }

  /**
   * Exports full chat history for the given room as an array of ChatMessage.
   * The caller must be a member of the room.
   */
  async exportChatHistory(
    userId: string,
    roomId: string,
  ): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Fetch all messages for this room (up to 1000 for now)
    const { data, error } = await supabase
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
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (data ?? []) as ChatMessage[];
  }

  /**
   * Returns the greeting and away messages set by the other participant(s) in the room.
   * Used to display automated messages when a chat is first opened.
   */
  /**
   * Add a label to a chat room.
   */
  async addLabel(userId: string, roomId: string, label: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    // Get current labels
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('labels')
      .eq('id', roomId)
      .single();

    if (!room) {
      throw new Error('Room not found');
    }

    const currentLabels: string[] = room.labels ?? [];
    if (currentLabels.includes(label)) {
      // Already exists
      return;
    }

    const newLabels = [...currentLabels, label];
    const { error } = await supabase
      .from('chat_rooms')
      .update({ labels: newLabels })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to add label: ${error.message}`);
    }
  }

  /**
   * Remove a label from a chat room.
   */
  async removeLabel(
    userId: string,
    roomId: string,
    label: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }

    const { data: room } = await supabase
      .from('chat_rooms')
      .select('labels')
      .eq('id', roomId)
      .single();

    if (!room) {
      return;
    }

    let currentLabels: string[] = room.labels ?? [];
    currentLabels = currentLabels.filter((l) => l !== label);

    const { error } = await supabase
      .from('chat_rooms')
      .update({ labels: currentLabels })
      .eq('id', roomId);

    if (error) {
      throw new Error(`Failed to remove label: ${error.message}`);
    }
  }

  /**
   * Get all unique labels across rooms that the current user is a member of.
   */
  async getUserLabels(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();

    const { data: memberRows } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId);

    const roomIds = (memberRows ?? []).map((r: any) => r.room_id);
    if (roomIds.length === 0) {
      return [];
    }

    const { data: rooms } = await supabase
      .from('chat_rooms')
      .select('labels')
      .in('id', roomIds);

    const labelSet = new Set<string>();
    for (const r of rooms ?? []) {
      const roomLabels: string[] = r.labels ?? [];
      for (const l of roomLabels) {
        labelSet.add(l);
      }
    }
    return Array.from(labelSet);
  }

  /**
   * Return all rooms belonging to the current user that have a specific label.
   */
  async getRoomsByLabel(
    userId: string,
    label: string,
  ): Promise<ChatRoomRecord[]> {
    const rooms = await this.getRooms(userId);
    return rooms.filter((r) => r.labels?.includes(label));
  }

  async getRoomGreeting(
    roomId: string,
    currentUserId: string,
  ): Promise<{ greetingMessage?: string; awayMessage?: string }> {
    const supabase = this.supabaseService.getClient();

    // Find the other user in this private room (skip group chats for simplicity)
    const { data: members } = await supabase
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .neq('user_id', currentUserId);

    if (!members || members.length === 0) {
      return {};
    }

    // We fetch the first other user's profile
    const otherUserId = (members as { user_id: string }[])[0].user_id;

    const { data: profile } = await supabase
      .from('users')
      .select('greeting_message, away_message')
      .eq('id', otherUserId)
      .single();

    if (!profile) {
      return {};
    }

    return {
      greetingMessage: (profile as any).greeting_message ?? undefined,
      awayMessage: (profile as any).away_message ?? undefined,
    };
  }
}
