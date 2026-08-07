import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Registry } from 'prom-client';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminActionMetrics } from './monitoring.interfaces';

interface ThenableQueryBuilder {
  then: (resolve: (value: unknown) => void, reject: (err: Error) => void) => void;
  select: jest.Mock;
  eq: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}

function makeThenable(result: unknown, isError = false): ThenableQueryBuilder {
  const self: ThenableQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    then(resolve: (value: unknown) => void, reject: (err: Error) => void): void {
      if (isError) {
        reject(result as Error);
      } else {
        resolve(result);
      }
    },
  };
  return self;
}

function findCounterValue(json: unknown, name: string, label?: { key: string; value: string }): number {
  const arr = json as Array<{ name: string; values: Array<{ value: number; labels: Record<string, string> }> }>;
  const entry = arr.find((m) => m.name === name);
  if (!entry) return 0;
  if (!label) return entry.values[0]?.value ?? 0;
  return entry.values.find((v) => v.labels?.[label.key] === label.value)?.value ?? 0;
}

function findGaugeValue(json: unknown, name: string): number {
  const arr = json as Array<{ name: string; values: Array<{ value: number }> }>;
  const entry = arr.find((m) => m.name === name);
  return entry?.values[0]?.value ?? 0;
}

describe('MonitoringService', () => {
  let service: MonitoringService;
  let registry: Registry;
  let supabaseClient: Record<string, jest.Mock>;

  beforeEach(async () => {
    registry = new Registry();

    supabaseClient = {
      from: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'DD_API_KEY' || key === 'DD_APP_KEY') return '';
              return undefined;
            }),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            getRegister: jest.fn().mockReturnValue(registry),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(() => supabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    registry.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordAdminAction', () => {
    it('records a ban action', async () => {
      const action: AdminActionMetrics = {
        actionType: 'ban',
        count: 3,
        timeWindowSeconds: 3600,
      };

      service.recordAdminAction(action);

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(json, 'hellotalk_admin_action_count', {
        key: 'action',
        value: 'ban',
      });
      expect(value).toBe(3);
    });

    it('records a warn action', async () => {
      service.recordAdminAction({
        actionType: 'warn',
        count: 1,
        timeWindowSeconds: 0,
      });

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(json, 'hellotalk_admin_action_count', {
        key: 'action',
        value: 'warn',
      });
      expect(value).toBe(1);
    });

    it('records a vip_change action', async () => {
      service.recordAdminAction({
        actionType: 'vip_change',
        count: 1,
        timeWindowSeconds: 0,
      });

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(json, 'hellotalk_admin_action_count', {
        key: 'action',
        value: 'vip_change',
      });
      expect(value).toBe(1);
    });

    it('records a block_remove action', async () => {
      service.recordAdminAction({
        actionType: 'block_remove',
        count: 1,
        timeWindowSeconds: 0,
      });

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(json, 'hellotalk_admin_action_count', {
        key: 'action',
        value: 'block_remove',
      });
      expect(value).toBe(1);
    });

    it('increments the same counter label on multiple calls', async () => {
      service.recordAdminAction({
        actionType: 'ban',
        count: 2,
        timeWindowSeconds: 0,
      });
      service.recordAdminAction({
        actionType: 'ban',
        count: 3,
        timeWindowSeconds: 0,
      });

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(json, 'hellotalk_admin_action_count', {
        key: 'action',
        value: 'ban',
      });
      expect(value).toBe(5);
    });
  });

  describe('recordLoginHistoryAccess', () => {
    it('increments the login history access counter', async () => {
      service.recordLoginHistoryAccess();
      service.recordLoginHistoryAccess();

      const json = await registry.getMetricsAsJSON();
      const value = findCounterValue(
        json,
        'hellotalk_admin_login_history_access',
      );
      expect(value).toBe(2);
    });
  });

  describe('collectModerationQueueMetrics', () => {
    it('returns zero metrics when no pending reports exist', async () => {
      const qb = makeThenable({ count: 0, error: null });
      supabaseClient.from.mockReturnValue(qb);

      const result = await service.collectModerationQueueMetrics();

      expect(result.pendingReports).toBe(0);
      expect(result.pendingMoments).toBe(0);
      expect(result.unprocessedFlags).toBe(0);
      expect(result.oldestPendingMinutes).toBe(0);
    });

    it('collects pending report counts and updates gauge', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000).toISOString();

      const qb1 = makeThenable({ count: 15, error: null });
      const qb2 = makeThenable({ count: 5, error: null });
      const qb3 = makeThenable({
        data: { created_at: fiveMinutesAgo },
        error: null,
      });
      supabaseClient.from
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2)
        .mockReturnValueOnce(qb3);

      const result = await service.collectModerationQueueMetrics();

      expect(result.pendingReports).toBe(15);
      expect(result.pendingMoments).toBe(5);
      expect(result.unprocessedFlags).toBe(10);
      expect(result.oldestPendingMinutes).toBe(5);

      const json = await registry.getMetricsAsJSON();
      const gaugeVal = findGaugeValue(
        json,
        'hellotalk_moderation_pending_reports',
      );
      expect(gaugeVal).toBe(15);
    });

    it('handles Supabase errors gracefully', async () => {
      supabaseClient.from.mockReturnValue(
        makeThenable(new Error('DB error'), true),
      );

      const result = await service.collectModerationQueueMetrics();

      expect(result.pendingReports).toBe(0);
      expect(result.pendingMoments).toBe(0);
    });
  });

  describe('collectAdminDashboardMetrics', () => {
    it('collects user, report and block counts', async () => {
      supabaseClient.from
        .mockReturnValueOnce(makeThenable({ count: 1000, error: null }))
        .mockReturnValueOnce(makeThenable({ count: 50, error: null }))
        .mockReturnValueOnce(makeThenable({ count: 30, error: null }));

      const result = await service.collectAdminDashboardMetrics();

      expect(result.totalUsers).toBe(1000);
      expect(result.totalReports).toBe(50);
      expect(result.totalBlocks).toBe(30);
      expect(result.errorRate).toBe(0);
      expect(result.p95Latency).toBe(0);
      expect(result.activeAdmins).toBe(0);

      const json = await registry.getMetricsAsJSON();
      expect(findGaugeValue(json, 'hellotalk_admin_total_users')).toBe(1000);
      expect(findGaugeValue(json, 'hellotalk_admin_total_reports')).toBe(50);
      expect(findGaugeValue(json, 'hellotalk_admin_total_blocks')).toBe(30);
    });

    it('handles Supabase errors gracefully', async () => {
      supabaseClient.from.mockReturnValue(
        makeThenable(new Error('DB error'), true),
      );

      const result = await service.collectAdminDashboardMetrics();

      expect(result.totalUsers).toBe(0);
      expect(result.totalReports).toBe(0);
      expect(result.totalBlocks).toBe(0);
    });
  });
});