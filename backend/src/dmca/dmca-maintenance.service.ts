import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DMCA_BATCH_SIZE,
  DMCA_CLOSED_RETENTION_YEARS,
  DMCA_EXPIRED_RETENTION_DAYS,
  DMCA_STUCK_VERIFIED_MINUTES,
} from './dmca.constants';
import { DmcaMediaService } from './dmca-media.service';
import { daysBefore, monthsBefore } from './dmca-policy';
import { DmcaService } from './dmca.service';

/**
 * Scheduled work for the takedown flow. Every step is idempotent and guarded by
 * a compare-and-set, so it is safe if two replicas run it at once.
 */
@Injectable()
export class DmcaMaintenanceService {
  private readonly logger = new Logger(DmcaMaintenanceService.name);
  private running = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly dmcaService: DmcaService,
    private readonly mediaService: DmcaMediaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  @Cron('0 */5 * * * *', { name: 'dmcaMaintenance' })
  async runMaintenance(now: Date = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const steps: Array<[string, () => Promise<unknown>]> = [
        ['process_verified', () => this.retryStuckVerified(now)],
        ['restore_due', () => this.restoreDueNotices(now)],
        ['sync_media', () => this.dmcaService.syncPendingMedia()],
        ['expire_unverified', () => this.expireUnverified(now)],
        ['sweep_orphans', () => this.sweepOrphanedSnapshots()],
      ];
      for (const [name, step] of steps) {
        try {
          await step();
        } catch {
          // One failing step must not starve the others; the next run retries.
          this.logger.error(`dmca_maintenance_step_failed step=${name}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'dmcaRetention' })
  async purgeRetainedRecords(now: Date = new Date()): Promise<void> {
    const client = this.supabaseService.getClient();
    const closedCutoff = monthsBefore(now, DMCA_CLOSED_RETENTION_YEARS * 12);
    const expiredCutoff = daysBefore(now, DMCA_EXPIRED_RETENTION_DAYS);

    // Events and counter-notices go with the notice (ON DELETE CASCADE).
    const { error: closedError } = await client
      .from('dmca_notices')
      .delete()
      .lt('closed_at', closedCutoff.toISOString());
    const { error: expiredError } = await client
      .from('dmca_notices')
      .delete()
      .eq('status', 'expired')
      .lt('created_at', expiredCutoff.toISOString());
    if (closedError || expiredError) {
      this.logger.error('dmca_retention_purge_failed');
    }
  }

  /** Confirmed notices whose processing was interrupted (for example a restart). */
  async retryStuckVerified(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - DMCA_STUCK_VERIFIED_MINUTES * 60_000,
    );
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('*')
      .eq('status', 'pending_verification')
      .not('verified_at', 'is', null)
      .lt('verified_at', cutoff.toISOString())
      .order('verified_at', { ascending: true })
      .limit(DMCA_BATCH_SIZE);
    if (error) throw new Error('stuck_notice_query_failed');

    let processed = 0;
    for (const notice of data ?? []) {
      await this.dmcaService.processVerifiedNotice(notice, now);
      processed += 1;
    }
    return processed;
  }

  /** Counter-notified material returns once the waiting period has passed. */
  async restoreDueNotices(now: Date = new Date()): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('*')
      .eq('status', 'counter_notice_received')
      .lte('restore_after', now.toISOString())
      .order('restore_after', { ascending: true })
      .limit(DMCA_BATCH_SIZE);
    if (error) throw new Error('restore_due_query_failed');

    let restored = 0;
    for (const notice of data ?? []) {
      const closed = await this.dmcaService.closeNotice(
        notice,
        'restored',
        ['counter_notice_received'],
        { type: 'system' },
        now,
      );
      if (closed) restored += 1;
    }
    if (restored > 0)
      this.logger.log(`dmca_restored_after_counter_notice count=${restored}`);
    return restored;
  }

  async expireUnverified(now: Date = new Date()): Promise<number> {
    const nowIso = now.toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .update({ status: 'expired', closed_at: nowIso, updated_at: nowIso })
      .eq('status', 'pending_verification')
      .is('verified_at', null)
      .lt('verification_expires_at', nowIso)
      .select('id');
    if (error) throw new Error('expire_unverified_failed');

    const expired = data?.length ?? 0;
    if (expired > 0) {
      this.metrics?.recordDmcaEvent('verification_expired');
      this.logger.log(`dmca_unverified_expired count=${expired}`);
    }
    return expired;
  }

  /** Removes snapshots (and any private file copies) for items that were deleted. */
  async sweepOrphanedSnapshots(): Promise<number> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('dmca_orphaned_snapshots', {
      p_limit: DMCA_BATCH_SIZE,
    });
    if (error) throw new Error('orphan_query_failed');

    let removed = 0;
    for (const orphan of data ?? []) {
      const outcome = await this.mediaService.discard(
        this.mediaService.parse(orphan.media_objects),
      );
      if (outcome.failed > 0) continue;

      const { error: deleteError } = await client
        .from('dmca_content_snapshots')
        .delete()
        .eq('target_type', orphan.target_type)
        .eq('target_id', orphan.target_id);
      if (!deleteError) removed += 1;
    }
    return removed;
  }
}
