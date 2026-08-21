import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FavouritesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addFavourite(
    userId: string,
    dto: { message_id: string; note_text?: string },
  ): Promise<{
    id: string;
    user_id: string;
    item_type: string;
    item_payload: Record<string, unknown>;
    notes: string | null;
  }> {
    const supabase = this.supabaseService.getClient();

    // Fetch the message to store as payload
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

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async removeFavourite(userId: string, favouriteId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('favourites')
      .delete()
      .eq('id', favouriteId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  }

  async getUserFavourites(userId: string): Promise<Record<string, unknown>[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
