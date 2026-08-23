import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AddFavouriteDto } from '../chat/dto/add-favourite.dto';

@Injectable()
export class FavouritesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addFavourite(
    userId: string,
    dto: AddFavouriteDto,
  ): Promise<{
    id: string;
    user_id: string;
    item_type: string;
    item_payload: Record<string, unknown>;
    notes: string | null;
  }> {
    const supabase = this.supabaseService.getClient();

    // Fetch the canonical message. The database trigger performs the final
    // room-membership authorization check even for service-role writes.
    const messageResponse = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', dto.message_id)
      .single();

    if (messageResponse.error || !messageResponse.data) {
      throw new Error('Message not found');
    }

    const message = messageResponse.data as Record<string, unknown>;

    const insertResponse = await supabase
      .from('favourites')
      .insert({
        user_id: userId,
        item_type: 'message' as const,
        item_payload: message,
        notes: dto.note_text ?? null,
      })
      .select()
      .single();

    if (insertResponse.error || !insertResponse.data) {
      throw new Error('Failed to add favourite');
    }
    return insertResponse.data;
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
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error('Failed to load favourites');
    return data ?? [];
  }
}
