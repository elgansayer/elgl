import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const BUSINESS = '44444444-4444-4444-8444-444444444444';

type Result = { data?: unknown; error?: unknown; count?: number | null };

/**
 * Minimal chainable query fake. Each table gets its own queue of results for
 * `maybeSingle`, `single` and for awaiting the builder directly.
 */
function fakeTable(results: {
  maybeSingle?: Result[];
  single?: Result[];
  awaited?: Result[];
}) {
  const maybeSingle = [...(results.maybeSingle ?? [])];
  const single = [...(results.single ?? [])];
  const awaited = [...(results.awaited ?? [])];
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    'select',
    'eq',
    'in',
    'gte',
    'order',
    'limit',
    'insert',
    'upsert',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(maybeSingle.shift() ?? { data: null, error: null }),
  );
  builder.single = vi.fn(() =>
    Promise.resolve(single.shift() ?? { data: null, error: null }),
  );
  builder.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(
      awaited.shift() ?? { data: [], error: null, count: 0 },
    ).then(resolve),
  );
  return builder;
}

describe('SafetyService business target contract', () => {
  let service: SafetyService;
  let from: ReturnType<typeof vi.fn>;
  let metrics: {
    recordTsReportSubmitted: ReturnType<typeof vi.fn>;
    recordTsBlockCreated: ReturnType<typeof vi.fn>;
    recordTsBlockRemoved: ReturnType<typeof vi.fn>;
    recordTsSafetyOperation: ReturnType<typeof vi.fn>;
  };
  let cache: {
    invalidateUserCaches: ReturnType<typeof vi.fn>;
    invalidateUserPairCaches: ReturnType<typeof vi.fn>;
    invalidateTrustAndSafetyCaches: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    from = vi.fn();
    metrics = {
      recordTsReportSubmitted: vi.fn(),
      recordTsBlockCreated: vi.fn(),
      recordTsBlockRemoved: vi.fn(),
      recordTsSafetyOperation: vi.fn(),
    };
    cache = {
      invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
      invalidateUserPairCaches: vi.fn().mockResolvedValue(undefined),
      invalidateTrustAndSafetyCaches: vi.fn().mockResolvedValue(undefined),
    };

    service = new SafetyService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      metrics as unknown as MetricsService,
      cache as unknown as SafetyCacheInvalidationService,
    );
  });

  it('blocks a business account through the same user safety boundary', async () => {
    const users = fakeTable({
      maybeSingle: [{ data: { id: BUSINESS }, error: null }],
    });
    const blocks = fakeTable({
      awaited: [{ data: [{ id: 'block-1' }], error: null }],
    });
    from.mockImplementation((table: string) =>
      table === 'users' ? users : blocks,
    );

    const result = await service.blockUser(VIEWER, { blocked_id: BUSINESS });

    expect(result).toEqual({
      success: true,
      blocked_id: BUSINESS,
      already_blocked: false,
    });
    expect(from).toHaveBeenCalledWith('users');
    expect(from).toHaveBeenCalledWith('blocks');
    expect(blocks.upsert).toHaveBeenCalledWith(
      { blocker_id: VIEWER, blocked_id: BUSINESS },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
    expect(metrics.recordTsBlockCreated).toHaveBeenCalledTimes(1);
    expect(cache.invalidateUserPairCaches).toHaveBeenCalledWith(
      VIEWER,
      BUSINESS,
    );
  });

  it('reports a business account through the same user safety boundary', async () => {
    const users = fakeTable({
      maybeSingle: [{ data: { id: BUSINESS }, error: null }],
    });
    const reports = fakeTable({
      maybeSingle: [{ data: null, error: null }],
      awaited: [{ count: 0, error: null }],
      single: [{ data: { id: 'report-1' }, error: null }],
    });
    from.mockImplementation((table: string) =>
      table === 'users' ? users : reports,
    );

    const result = await service.reportUser(VIEWER, {
      reported_id: BUSINESS,
      reason_category: 'spam',
      description: 'Unwanted promotion',
      context_url: '/profile/business-user',
    });

    expect(result).toEqual({ id: 'report-1', duplicate: false });
    expect(from).toHaveBeenCalledWith('users');
    expect(from).toHaveBeenCalledWith('reports');
    expect(reports.insert).toHaveBeenCalledWith({
      reporter_id: VIEWER,
      reported_user_id: BUSINESS,
      reason_category: 'spam',
      description: 'Unwanted promotion',
      context_url: '/profile/business-user',
      status: 'pending',
    });
    expect(metrics.recordTsReportSubmitted).toHaveBeenCalledWith('spam');
    expect(cache.invalidateUserCaches).toHaveBeenCalledWith(BUSINESS);
  });

  it('does not require a separate business identity table for safety actions', async () => {
    const users = fakeTable({
      maybeSingle: [{ data: { id: BUSINESS }, error: null }],
    });
    const blocks = fakeTable({
      awaited: [{ data: [{ id: 'block-1' }], error: null }],
    });
    from.mockImplementation((table: string) =>
      table === 'users' ? users : blocks,
    );

    await service.blockUser(VIEWER, { blocked_id: BUSINESS });

    const tables = from.mock.calls.map(([table]) => table);
    expect(tables).toEqual(['users', 'blocks']);
    expect(tables).not.toContain('business_profiles');
  });
});
