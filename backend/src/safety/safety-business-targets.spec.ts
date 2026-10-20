import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';

describe('SafetyService business target contract', () => {
  let service: SafetyService;
  let query: {
    insert: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    response: { data?: unknown; error?: unknown };
  };
  let from: ReturnType<typeof vi.fn>;
  let metrics: {
    recordTsReportSubmitted: ReturnType<typeof vi.fn>;
    recordTsBlockCreated: ReturnType<typeof vi.fn>;
    recordTsBlockRemoved: ReturnType<typeof vi.fn>;
  };
  let cache: {
    invalidateUserCaches: ReturnType<typeof vi.fn>;
    invalidateUserPairCaches: ReturnType<typeof vi.fn>;
    invalidateTrustAndSafetyCaches: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      response: { data: null, error: null },
      then: vi.fn((resolve: (value: unknown) => void) =>
        resolve(query.response),
      ),
    };
    from = vi.fn().mockReturnValue(query);
    metrics = {
      recordTsReportSubmitted: vi.fn(),
      recordTsBlockCreated: vi.fn(),
      recordTsBlockRemoved: vi.fn(),
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
    query.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'business-user' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    query.response = { error: null };

    const result = await service.blockUser('viewer-user', {
      blocked_id: 'business-user',
    });

    expect(result).toEqual({ success: true, blocked_id: 'business-user' });
    expect(from).toHaveBeenCalledWith('users');
    expect(from).toHaveBeenCalledWith('blocks');
    expect(query.insert).toHaveBeenCalledWith({
      blocker_id: 'viewer-user',
      blocked_id: 'business-user',
    });
    expect(metrics.recordTsBlockCreated).toHaveBeenCalledTimes(1);
    expect(cache.invalidateUserPairCaches).toHaveBeenCalledWith(
      'viewer-user',
      'business-user',
    );
  });

  it('reports a business account through the same user safety boundary', async () => {
    query.single
      .mockResolvedValueOnce({ data: { id: 'business-user' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'report-1' }, error: null });

    const result = await service.reportUser('viewer-user', {
      reported_id: 'business-user',
      reason_category: 'spam',
      description: 'Unwanted promotion',
      context_url: '/profile/business-user',
    });

    expect(result).toEqual({ id: 'report-1' });
    expect(from).toHaveBeenCalledWith('users');
    expect(from).toHaveBeenCalledWith('reports');
    expect(query.insert).toHaveBeenCalledWith({
      reporter_id: 'viewer-user',
      reported_user_id: 'business-user',
      reason_category: 'spam',
      description: 'Unwanted promotion',
      context_url: '/profile/business-user',
      status: 'pending',
    });
    expect(metrics.recordTsReportSubmitted).toHaveBeenCalledWith('spam');
    expect(cache.invalidateUserCaches).toHaveBeenCalledWith('business-user');
  });

  it('does not require a separate business identity table for safety actions', async () => {
    query.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'business-user' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    query.response = { error: null };

    await service.blockUser('viewer-user', { blocked_id: 'business-user' });

    const tables = from.mock.calls.map(([table]) => table);
    expect(tables).toEqual(['users', 'blocks', 'blocks']);
    expect(tables).not.toContain('business_profiles');
  });
});
