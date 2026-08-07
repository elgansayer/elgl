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
        favouritesRes,
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('moments').select('*').eq('author_id', userId),
        supabase.from('moment_comments').select('*').eq('author_id', userId),
        supabase.from('chat_messages').select('*').eq('sender_id', userId),
        supabase.from('flashcards').select('*').eq('user_id', userId),
        supabase.from('favourites').select('*').eq('user_id', userId),
      ]);

      if (profileRes.error) {
        throw new Error(`Failed to fetch profile: ${profileRes.error.message}`);
      }

      const result: Record<string, unknown> = {
        profile: profileRes.data as unknown,
        moments: momentsRes.data as unknown,
        comments: commentsRes.data as unknown,
        messages: messagesRes.data as unknown,
        flashcards: flashcardsRes.data as unknown,
        favourites: favouritesRes.data as unknown,
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