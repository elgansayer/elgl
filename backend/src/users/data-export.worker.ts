import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataExportWorker {
  private readonly logger = new Logger(DataExportWorker.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    this.logger.log({ event: 'data_export_started' });

    try {
      const supabase = this.supabaseService.getClient();

      const [
        profileRes,
        momentsRes,
        commentsRes,
        likesRes,
        messagesRes,
        flashcardsRes,
        decksRes,
        favouritesRes,
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        // The Moments tables are owned through user_id (005_moments.sql).
        supabase.from('moments').select('*').eq('user_id', userId),
        supabase.from('moment_comments').select('*').eq('user_id', userId),
        supabase.from('moment_likes').select('*').eq('user_id', userId),
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
        this.failExport('profile');
      }

      // An unreadable Moments dataset must not be exported as null: that is how
      // a query on a column that did not exist went unnoticed.
      const momentsFailure = [
        { dataset: 'moments', error: momentsRes.error },
        { dataset: 'moment_comments', error: commentsRes.error },
        { dataset: 'moment_likes', error: likesRes.error },
      ].find(({ error }) => error);
      if (momentsFailure?.error) {
        this.failExport(momentsFailure.dataset);
      }

      const result: Record<string, unknown> = {
        profile: profileRes.data,
        moments: momentsRes.data,
        comments: commentsRes.data,
        moment_likes: likesRes.data,
        messages: messagesRes.data,
        flashcards: flashcardsRes.data,
        decks: decksRes.data,
        deck_flashcards: deckFlashcardsRes.data,
        favourites: favouritesRes.data,
        exported_at: new Date().toISOString(),
      };

      this.logger.log({ event: 'data_export_completed' });
      return result;
    } catch {
      this.logger.error({ event: 'data_export_failed' });
      throw new Error('Data export failed');
    }
  }

  private failExport(dataset: string): never {
    this.logger.error({ event: 'data_export_dataset_failed', dataset });
    throw new Error('Data export failed');
  }
}
