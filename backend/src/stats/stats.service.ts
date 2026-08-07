import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StatsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(userId: string): Promise<{
    translations_count: number;
    corrections_count: number;
    messages_count: number;
    moments_count: number;
  }> {
    const client = this.supabaseService.getClient();

    // moments count
    const { count: momentsCount, error: momentsErr } = await client
      .from('moments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (momentsErr) {
      throw new Error(momentsErr.message);
    }

    // corrections count (moment_comments with non-null correction_payload)
    const { count: correctionsCount, error: corrErr } = await client
      .from('moment_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('correction_payload', 'is', null);
    if (corrErr) {
      throw new Error(corrErr.message);
    }

    // messages count
    const { count: messagesCount, error: msgErr } = await client
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId);
    if (msgErr) {
      throw new Error(msgErr.message);
    }

    // translations count – placeholder (table may not exist yet)
    const translationsCount = 0;

    return {
      translations_count: translationsCount,
      corrections_count: correctionsCount ?? 0,
      messages_count: messagesCount ?? 0,
      moments_count: momentsCount ?? 0,
    };
  }
}
