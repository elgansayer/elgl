import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ChatPinState {
  room_id: string;
  is_pinned: boolean;
}

@Injectable()
export class ChatPinsService {
  private readonly logger = new Logger(ChatPinsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPinnedRoomIds(userId: string): Promise<string[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('chat_room_pins')
      .select('room_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      this.logStoreFailure('list', error.code);
      throw new ServiceUnavailableException(
        'Pinned chats are temporarily unavailable.',
      );
    }

    return (data ?? [])
      .map((row: { room_id?: unknown }) => row.room_id)
      .filter((roomId): roomId is string => typeof roomId === 'string');
  }

  async setPinned(
    userId: string,
    roomId: string,
    isPinned: boolean,
  ): Promise<ChatPinState> {
    const client = this.supabaseService.getClient();
    const { data: membership, error: membershipError } = await client
      .from('chat_room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      this.logStoreFailure('membership', membershipError.code);
      throw new ServiceUnavailableException(
        'Unable to verify chat membership right now.',
      );
    }
    if (!membership) {
      throw new NotFoundException('Chat room not found.');
    }

    if (isPinned) {
      const { error } = await client.from('chat_room_pins').upsert(
        { user_id: userId, room_id: roomId },
        { onConflict: 'user_id,room_id', ignoreDuplicates: true },
      );
      if (error) {
        this.logStoreFailure('pin', error.code);
        throw new ServiceUnavailableException(
          'Unable to pin this chat right now.',
        );
      }
    } else {
      const { error } = await client
        .from('chat_room_pins')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId);
      if (error) {
        this.logStoreFailure('unpin', error.code);
        throw new ServiceUnavailableException(
          'Unable to unpin this chat right now.',
        );
      }
    }

    return { room_id: roomId, is_pinned: isPinned };
  }

  private logStoreFailure(operation: string, providerCode?: string): void {
    this.logger.warn({
      event: 'chat_pin_store_failure',
      operation,
      providerCode: providerCode || 'unknown',
    });
  }
}
