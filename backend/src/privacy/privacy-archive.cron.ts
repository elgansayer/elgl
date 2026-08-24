import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrivacyService } from './privacy.service';

const CLEANUP_BATCH_SIZE = 100;
const MAX_BATCHES_PER_RUN = 20;

@Injectable()
export class PrivacyArchiveCron {
  private readonly logger = new Logger(PrivacyArchiveCron.name);

  constructor(private readonly privacyService: PrivacyService) {}

  @Cron('0 3 * * *')
  async purgeExpiredArchives(): Promise<void> {
    let totalPurged = 0;

    try {
      for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
        const purged = await this.privacyService.purgeExpiredArchives(
          CLEANUP_BATCH_SIZE,
        );
        totalPurged += purged;
        if (purged < CLEANUP_BATCH_SIZE) break;
      }

      if (totalPurged > 0) {
        this.logger.log(`gdpr_archive_retention_cleanup count=${totalPurged}`);
      }
    } catch {
      // Cleanup is retried on the next scheduled run. Never include object keys,
      // user identifiers, signed URLs or provider errors in operational logs.
      this.logger.error('gdpr_archive_retention_cleanup_failed');
    }
  }
}
