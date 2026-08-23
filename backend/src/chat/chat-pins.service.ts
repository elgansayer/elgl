import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

type ChatRoomPinRow = {
  user_id: string;
  room_id: string;
  created_at: string;
};

type ChatPinsDatabase = {
  public: {
    Tables: {
      chat_room_pins: {
        Row: ChatRoomPinRow;
        Insert: Pick<ChatRoomPinRow, 'user_id' | 'room_id'> & {
          created_at?: string;
        };
        Update: Partial<ChatRoomPinRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export interface ChatPinState {
  room_id: string;
  is_pinned: boolean;
}

@Injectable()
export class ChatPinsService {
  private readonly logger = new Logger(ChatPinsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPinnedRoomIds(userId: string): Promise<string[]> {
    const { data, error } = await this.getPinsClient()
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
      .map((row) => row.room_id)
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

    const pinsClient = this.getPinsClient();
    if (isPinned) {
      const { error } = await pinsClient
        .from('chat_room_pins')
        .upsert(
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
      const { error } = await pinsClient
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

  private getPinsClient(): SupabaseClient<ChatPinsDatabase> {
    // This table is introduced by this issue's additive migration. Keep the
    // local schema explicit until the repository-wide generated type snapshot
    // is refreshed after deployment.
    return this.supabaseService
      .getClient() as unknown as SupabaseClient<ChatPinsDatabase>;
  }

  private logStoreFailure(operation: string, providerCode?: string): void {
    this.logger.warn({
      event: 'chat_pin_store_failure',
      operation,
      providerCode: providerCode || 'unknown',
    });
  }
}
