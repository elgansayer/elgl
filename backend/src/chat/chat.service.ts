import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';

@Injectable()
export class ChatService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  generateConnectionToken(userId: string): { token: string } {
    return this.centrifugoService.generateConnectionToken(userId);
  }

  async getRooms(): Promise<ChatRoomRecord[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('chat_rooms')
      .select('id, title, subtitle, avatar, is_online, is_pinned, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });

    if (response.error || !response.data || response.data.length === 0) {
      return [
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
    }

    return response.data as ChatRoomRecord[];
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessage> {
    const supabase = this.supabaseService.getClient();
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

    return savedMessage;
  }

  async getMessages(roomId: string, search?: string): Promise<ChatMessage[]> {
    const supabase = this.supabaseService.getClient();
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

    if (search && search.trim().length > 0) {
      query = query.ilike('text_content', `%${search.trim()}%`);
    }

    const response = await query;
    if (response.error || !response.data || response.data.length === 0) {
      return [
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

    const message = messageResponse.data;

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
