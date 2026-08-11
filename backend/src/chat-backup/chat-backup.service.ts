import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ChatBackupService {
  private readonly logger = new Logger(ChatBackupService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async createBackup(userId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(`Backup failed for user ${userId}: ${error.message}`);
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return '';
    }

    // Stream formatting logic
    let formattedStream = 'Backup Start\n';
    for (const msg of data) {
      const message = msg as typeof msg & { sender?: string; content?: string };
      formattedStream += `[${msg.created_at}] ${message.sender ?? msg.sender_id}: ${message.content ?? msg.text_content ?? ''}\n`;
    }
    formattedStream += 'Backup End\n';

    return formattedStream;
  }

  async exportChannelBackup(
    channelId: string,
  ): Promise<Record<string, unknown>[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Export failed for channel ${channelId}: ${error.message}`,
      );
      throw new Error(error.message);
    }

    return data ?? [];
  }

  async importChannelBackup(
    channelId: string,
    messages: Record<string, unknown>[],
  ): Promise<number> {
    const supabase = this.supabaseService.getClient();

    // Prepare rows for insert (strip any `id` to let Supabase generate new UUIDs)
    const rows = messages.map((msg) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = msg;
      return {
        ...rest,
        channel_id: channelId,
      };
    });

    // Insert in chunks of 500 to avoid payload size limits
    const chunkSize = 500;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(chunk)
        .select('id');

      if (error) {
        this.logger.error(
          `Import failed for chunk starting at index ${i}: ${error.message}`,
        );
        throw new Error(error.message);
      }
      totalInserted += data?.length ?? 0;
    }

    return totalInserted;
  }
}
