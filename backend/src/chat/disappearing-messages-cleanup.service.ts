import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

const CLEANUP_BATCH_SIZE = 500;

/**
 * Physically removes expired message content in small, concurrency-safe batches.
 * Read paths also suppress expired rows, so a delayed cleanup never extends the
 * product-visible lifetime of a disappearing message.
 */
@Injectable()
export class DisappearingMessagesCleanupService {
  private readonly logger = new Logger(DisappearingMessagesCleanupService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron('0 * * * * *', { name: 'purgeExpiredChatMessages' })
  async purgeExpiredMessages(): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('purge_expired_chat_messages', { p_limit: CLEANUP_BATCH_SIZE });

    if (error) {
      this.logger.error(
        `disappearing_message_cleanup_failed code=${error.code ?? 'unknown'}`,
      );
      return;
    }

    const deletedCount = typeof data === 'number' ? data : Number(data ?? 0);
    if (Number.isFinite(deletedCount) && deletedCount > 0) {
      this.logger.log(`disappearing_message_cleanup deleted=${deletedCount}`);
    }
  }
}
