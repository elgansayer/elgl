import { Injectable } from '@nestjs/common';
import { AddFavouriteDto } from '../chat/dto/add-favourite.dto';
import { SupabaseService } from '../supabase/supabase.service';

interface FavouriteRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  message_id: string | null;
  item_type: string;
  item_payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

interface MessageVisibilityRow {
  id: string;
  room_id: string;
  deleted_for_user_ids: string[] | null;
}

export interface StarredMessagesPage {
  items: Record<string, unknown>[];
  has_more: boolean;
  next_offset: number | null;
}

@Injectable()
export class FavouritesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addFavourite(
    userId: string,
    dto: AddFavouriteDto,
  ): Promise<{ success: true }> {
    const supabase = this.supabaseService.getClient();

    // Supply only the message identity in the application-facing shape. The
    // database trigger resolves it onto the historical message_id column,
    // verifies room membership, and rebuilds the canonical message snapshot.
    const { error } = await supabase.from('favourites').insert({
      user_id: userId,
      item_type: 'message',
      item_payload: { id: dto.message_id },
      notes: dto.note_text ?? null,
    });

    if (error) {
      throw new Error('Failed to add favourite');
    }
    return { success: true };
  }

  async removeFavourite(
    userId: string,
    favouriteId: string,
  ): Promise<{ success: true }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('id', favouriteId)
      .eq('user_id', userId);

    if (error) throw new Error('Failed to remove favourite');
    return { success: true };
  }

  async getUserFavourites(userId: string): Promise<Record<string, unknown>[]> {
    const page = await this.getStarredMessages(userId, 100, 0);
    return page.items;
  }

  /**
   * Returns a bounded page of starred messages while re-checking current chat
   * visibility. Favourites store a message snapshot for fast review, so a
   * retrieval must not expose that snapshot after the user leaves the room or
   * after the underlying message is deleted.
   */
  async getStarredMessages(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<StarredMessagesPage> {
    const supabase = this.supabaseService.getClient();

    // range() is inclusive. Request one extra row so callers can paginate
    // without an expensive exact-count query over private message metadata.
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .eq('item_type', 'message')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      throw new Error('Failed to load starred messages');
    }

    const rows = (data ?? []) as FavouriteRow[];
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const messageIds = pageRows
      .map((row) => row.message_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (messageIds.length === 0) {
      return {
        items: [],
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    }

    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, room_id, deleted_for_user_ids')
      .in('id', messageIds);

    if (messageError) {
      throw new Error('Failed to verify starred message visibility');
    }

    const messages = (messageData ?? []) as MessageVisibilityRow[];
    const roomIds = [...new Set(messages.map((message) => message.room_id))];

    if (roomIds.length === 0) {
      return {
        items: [],
        has_more: hasMore,
        next_offset: hasMore ? offset + limit : null,
      };
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .in('room_id', roomIds);

    if (membershipError) {
      throw new Error('Failed to verify starred message membership');
    }

    const memberRoomIds = new Set(
      (membershipData ?? []).map(
        (membership: { room_id: string }) => membership.room_id,
      ),
    );
    const visibleMessageIds = new Set(
      messages
        .filter(
          (message) =>
            !message.deleted_for_user_ids?.includes(userId) &&
            memberRoomIds.has(message.room_id),
        )
        .map((message) => message.id),
    );

    return {
      items: pageRows.filter(
        (row) =>
          row.message_id !== null && visibleMessageIds.has(row.message_id),
      ),
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    };
  }
}
