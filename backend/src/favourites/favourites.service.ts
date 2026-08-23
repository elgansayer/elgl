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

    // Use the historical relational columns as the write contract. The
    // database trigger canonicalises the snapshot, validates membership, and
    // turns a retried insert into an idempotent update.
    const { error: insertError } = await supabase.from('favourites').insert({
      user_id: userId,
      message_id: dto.message_id,
      note_text: dto.note_text ?? null,
    });

    if (insertError) {
      throw new Error('Failed to add favourite');
    }

    const { data, error: readError } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .eq('message_id', dto.message_id)
      .single();

    if (readError || !data) {
      throw new Error('Failed to load saved favourite');
    }
    return data;
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
