import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from './centrifugo.service';

const CLEANUP_BATCH_SIZE = 500;

interface ExpiredMessageIdentity {
  message_id: string;
  room_id: string;
}

/**
 * Physically removes expired message content in small, concurrency-safe batches.
 * Read paths also suppress expired rows, so a delayed cleanup never extends the
 * product-visible lifetime of a disappearing message.
 */
@Injectable()
export class DisappearingMessagesCleanupService {
  private readonly logger = new Logger(DisappearingMessagesCleanupService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

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

    const deleted = this.normalizeDeletedRows(data);
    if (deleted.length === 0) return;

    const publications = await Promise.allSettled(
      deleted.map((message) =>
        this.centrifugoService.publish(`chat:${message.room_id}`, {
          type: 'message_deleted',
          deleted_for: 'everyone',
          message_id: message.message_id,
          reason: 'expired',
        }),
      ),
    );

    const failedPublications = publications.filter(
      (result) => result.status === 'rejected',
    ).length;

    this.logger.log(
      `disappearing_message_cleanup deleted=${deleted.length} realtime_failed=${failedPublications}`,
    );
  }

  private normalizeDeletedRows(value: unknown): ExpiredMessageIdentity[] {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
      if (
        typeof item === 'object' &&
        item !== null &&
        'message_id' in item &&
        'room_id' in item &&
        typeof item.message_id === 'string' &&
        typeof item.room_id === 'string' &&
        item.message_id.length > 0 &&
        item.room_id.length > 0
      ) {
        return [{ message_id: item.message_id, room_id: item.room_id }];
      }
      return [];
    });
  }
}
