import { Logger } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { DmcaNoticeRow, SupabaseService } from '../supabase/supabase.service';
import { createSupabaseDouble } from '../../test/support/supabase-double';
import { DmcaMaintenanceService } from './dmca-maintenance.service';
import { DmcaMediaService } from './dmca-media.service';
import { DmcaService } from './dmca.service';

const NOW = new Date('2026-11-11T10:00:00.000Z');

const notice = (id: string): DmcaNoticeRow => ({ id }) as DmcaNoticeRow;

describe('DmcaMaintenanceService', () => {
  let db: ReturnType<typeof createSupabaseDouble>;
  let dmca: {
    processVerifiedNotice: ReturnType<typeof vi.fn>;
    closeNotice: ReturnType<typeof vi.fn>;
    syncPendingMedia: ReturnType<typeof vi.fn>;
  };
  let media: {
    discard: ReturnType<typeof vi.fn>;
    parse: ReturnType<typeof vi.fn>;
  };
  let recordDmcaEvent: ReturnType<typeof vi.fn>;
  let service: DmcaMaintenanceService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    db = createSupabaseDouble();
    dmca = {
      processVerifiedNotice: vi.fn().mockResolvedValue(undefined),
      closeNotice: vi.fn().mockResolvedValue({ id: 'closed' }),
      syncPendingMedia: vi.fn().mockResolvedValue(0),
    };
    media = {
      discard: vi.fn().mockResolvedValue({ failed: 0 }),
      parse: vi.fn().mockReturnValue([]),
    };
    recordDmcaEvent = vi.fn();
    service = new DmcaMaintenanceService(
      { getClient: () => db.client } as unknown as SupabaseService,
      dmca as unknown as DmcaService,
      media as unknown as DmcaMediaService,
      { recordDmcaEvent } as unknown as MetricsService,
    );
  });

  it('retries confirmed notices that were never processed after five minutes', async () => {
    db.on('dmca_notices', 'select', { data: [notice('a'), notice('b')] });

    await expect(service.retryStuckVerified(NOW)).resolves.toBe(2);

    const query = db.queries('dmca_notices', 'select')[0];
    expect(db.hasCall(query, 'eq', 'status', 'pending_verification')).toBe(
      true,
    );
    expect(
      db.hasCall(query, 'lt', 'verified_at', '2026-11-11T09:55:00.000Z'),
    ).toBe(true);
    expect(db.hasCall(query, 'limit', 25)).toBe(true);
    expect(dmca.processVerifiedNotice).toHaveBeenCalledTimes(2);
  });

  it('restores material whose counter-notification waiting period has ended', async () => {
    db.on('dmca_notices', 'select', { data: [notice('a'), notice('b')] });
    dmca.closeNotice
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce(null);

    await expect(service.restoreDueNotices(NOW)).resolves.toBe(1);

    const query = db.queries('dmca_notices', 'select')[0];
    expect(db.hasCall(query, 'eq', 'status', 'counter_notice_received')).toBe(
      true,
    );
    expect(db.hasCall(query, 'lte', 'restore_after', NOW.toISOString())).toBe(
      true,
    );
    expect(dmca.closeNotice).toHaveBeenCalledWith(
      notice('a'),
      'restored',
      ['counter_notice_received'],
      { type: 'system' },
      NOW,
    );
  });

  it('lapses unconfirmed notices once the confirmation window has passed', async () => {
    db.on('dmca_notices', 'update', { data: [{ id: 'a' }, { id: 'b' }] });

    await expect(service.expireUnverified(NOW)).resolves.toBe(2);

    const update = db.queries('dmca_notices', 'update')[0];
    expect(db.payload(update, 'update')).toMatchObject({
      status: 'expired',
      closed_at: NOW.toISOString(),
    });
    expect(db.hasCall(update, 'is', 'verified_at', null)).toBe(true);
    expect(
      db.hasCall(update, 'lt', 'verification_expires_at', NOW.toISOString()),
    ).toBe(true);
    expect(recordDmcaEvent).toHaveBeenCalledWith('verification_expired');
  });

  it('fails loudly when expiry cannot be applied', async () => {
    db.on('dmca_notices', 'update', { data: null, error: { message: 'down' } });
    await expect(service.expireUnverified(NOW)).rejects.toThrow(
      'expire_unverified_failed',
    );
  });

  it('removes snapshots of deleted material only after their private files are gone', async () => {
    db.onRpc('dmca_orphaned_snapshots', {
      data: [
        { target_type: 'moment', target_id: 'm1', media_objects: [] },
        { target_type: 'moment_comment', target_id: 'c1', media_objects: [] },
      ],
    });
    media.discard
      .mockResolvedValueOnce({ failed: 0 })
      .mockResolvedValueOnce({ failed: 1 });

    await expect(service.sweepOrphanedSnapshots()).resolves.toBe(1);

    const deletions = db.queries('dmca_content_snapshots', 'delete');
    expect(deletions).toHaveLength(1);
    expect(db.hasCall(deletions[0], 'eq', 'target_id', 'm1')).toBe(true);
  });

  it('purges closed notices after three years and unconfirmed ones after thirty days', async () => {
    await service.purgeRetainedRecords(NOW);

    const [closed, expired] = db.queries('dmca_notices', 'delete');
    expect(
      db.hasCall(closed, 'lt', 'closed_at', '2023-11-11T10:00:00.000Z'),
    ).toBe(true);
    expect(db.hasCall(expired, 'eq', 'status', 'expired')).toBe(true);
    expect(
      db.hasCall(expired, 'lt', 'created_at', '2026-10-12T10:00:00.000Z'),
    ).toBe(true);
  });

  it('logs a failed retention purge without throwing', async () => {
    db.on('dmca_notices', 'delete', { data: null, error: { message: 'down' } });
    await expect(service.purgeRetainedRecords(NOW)).resolves.toBeUndefined();
    expect(vi.mocked(Logger.prototype.error)).toHaveBeenCalledWith(
      'dmca_retention_purge_failed',
    );
  });

  it('runs every step even if one fails, and never overlaps itself', async () => {
    db.on('dmca_notices', 'select', { data: null, error: { message: 'down' } });
    let release: () => void = () => undefined;
    dmca.syncPendingMedia.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          release = () => resolve(0);
        }),
    );

    const first = service.runMaintenance(NOW);
    await new Promise((resolve) => setImmediate(resolve));
    // A second tick while the first is still moving files is skipped.
    await service.runMaintenance(NOW);
    expect(dmca.syncPendingMedia).toHaveBeenCalledTimes(1);

    release();
    await first;

    expect(vi.mocked(Logger.prototype.error)).toHaveBeenCalledWith(
      'dmca_maintenance_step_failed step=process_verified',
    );
    expect(dmca.syncPendingMedia).toHaveBeenCalled();
    // The flag is released so the next tick runs.
    dmca.syncPendingMedia.mockResolvedValue(0);
    await service.runMaintenance(NOW);
    expect(dmca.syncPendingMedia).toHaveBeenCalledTimes(2);
  });
});
