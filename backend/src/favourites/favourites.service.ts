import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AddFavouriteDto } from '../chat/dto/add-favourite.dto';

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
