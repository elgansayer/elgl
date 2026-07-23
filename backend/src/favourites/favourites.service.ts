import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FavouritesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addFavourite(userId: string, dto: { message_id: string; note_text?: string }) {
    const supabase = this.supabaseService.getClient();

    // Fetch the message to store as payload
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', dto.message_id)
      .single();

    if (fetchError || !message) {
      throw new Error('Message not found');
    }

    const { data, error } = await supabase
      .from('favourites')
      .insert({
        user_id: userId,
        item_type: 'message',
        item_payload: message,
        notes: dto.note_text || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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

  async getUserFavourites(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}
