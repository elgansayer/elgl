import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataExportWorker {
  private readonly logger = new Logger(DataExportWorker.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    this.logger.log(`Starting data export for user ${userId}`);

    try {
      const supabase = this.supabaseService.getClient();

      const [
        profileRes,
        momentsRes,
        commentsRes,
        messagesRes,
        flashcardsRes,
        decksRes,
        favouritesRes,
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('moments').select('*').eq('author_id', userId),
        supabase.from('moment_comments').select('*').eq('author_id', userId),
        supabase.from('chat_messages').select('*').eq('sender_id', userId),
        supabase.from('flashcards').select('*').eq('user_id', userId),
        supabase.from('decks').select('*').eq('user_id', userId),
        supabase.from('favourites').select('*').eq('user_id', userId),
      ]);

      // Fetch deck_flashcards for the user's decks
      let deckFlashcardsRes: { data: unknown[]; error: unknown } = {
        data: [],
        error: null,
      };
      if (
        decksRes.data &&
        (decksRes.data as Array<{ id: string }>).length > 0
      ) {
        const deckIds = (decksRes.data as Array<{ id: string }>).map(
          (d) => d.id,
        );
        const res = await supabase
          .from('deck_flashcards')
          .select('*')
          .in('deck_id', deckIds);
        deckFlashcardsRes = res as { data: unknown[]; error: unknown };
      }

      if (profileRes.error) {
        throw new Error(`Failed to fetch profile: ${profileRes.error.message}`);
      }

      const result: Record<string, unknown> = {
        profile: profileRes.data,
        moments: momentsRes.data,
        comments: commentsRes.data,
        messages: messagesRes.data,
        flashcards: flashcardsRes.data,
        decks: decksRes.data,
        deck_flashcards: deckFlashcardsRes.data,
        favourites: favouritesRes.data,
        exported_at: new Date().toISOString(),
      };

      this.logger.log(`Data export completed for user ${userId}`);
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Data export failed for user ${userId}: ${msg}`);
      throw error;
    }
  }
}
