import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { SafetyService } from '../safety/safety.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import { ChatMessageEvent } from '../notifications/events/notification.events';

@Injectable()
export class ChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    private readonly eventEmitter: EventEmitter2,
    private readonly safetyService: SafetyService,
  ) {}

  generateConnectionToken(userId: string): { token: string } {
    return this.centrifugoService.generateConnectionToken(userId);
  }

  async getRooms(currentUserId?: string): Promise<ChatRoomRecord[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from rooms
    const blockedIds = currentUserId
      ? await this.safetyService.getBlockedAndBlockerIds(currentUserId)
      : [];

    const response = await supabase
      .from('chat_rooms')
      .select('id, title, subtitle, avatar, is_online, is_pinned, created_at')
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

    // If we have a current user, filter out rooms where the other participant is blocked
    if (currentUserId && blockedIds.length > 0) {
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

    // Publish to Centrifugo channel
    await this.centrifugoService.publish(`chat:${dto.room_id}`, {
      message: savedMessage,
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
              : '';

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.eventEmitter.emit(
        'chat.message',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        new ChatMessageEvent(
          senderId,
          receiverId,
          dto.room_id,
          dto.message_type,
          preview,
        ),
      );
    }

    return savedMessage;
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
      query = query.not('sender_id', 'in', `(${blockedIds.join(',')})`);
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
          text_content: 'Hello! I would love to practice languages with you.',
          media_url: null,
          correction_payload: null,
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
          media_url: null,
          correction_payload: null,
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
}
