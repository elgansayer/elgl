import { CanActivate } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PerformanceReportService } from './performance-report.service';
import type { PerformanceReportResponse } from './performance-report.types';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  let controller: StatsController;
  let statsService: StatsService;
  let reportService: PerformanceReportService;

  const mockAuthGuard: CanActivate = {
    canActivate: vi.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        {
          provide: StatsService,
          useValue: {
            getStats: vi.fn(),
          },
        },
        {
          provide: PerformanceReportService,
          useValue: {
            getReport: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<StatsController>(StatsController);
    statsService = module.get<StatsService>(StatsService);
    reportService = module.get<PerformanceReportService>(
      PerformanceReportService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('protects the personal stats endpoint with Supabase authentication', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      StatsController.prototype.getMyStats,
    ) as unknown[] | undefined;

    expect(guards).toContain(SupabaseAuthGuard);
  });

  describe('getMyStats', () => {
    it('should call statsService.getStats with the authenticated user id', async () => {
      const mockStats = {
        study_hours: [
          { day: 'Sun', hours: 0 },
          { day: 'Mon', hours: 1.5 },
          { day: 'Tue', hours: 2.0 },
          { day: 'Wed', hours: 1.0 },
          { day: 'Thu', hours: 3.5 },
          { day: 'Fri', hours: 2.5 },
          { day: 'Sat', hours: 4.0 },
        ],
        messages_sent: 340,
        corrections_count: 45,
        moments_count: 12,
      };

      vi.spyOn(statsService, 'getStats').mockResolvedValue(mockStats);

      const req = { user: { sub: 'user-1' } };
      const result = await controller.getMyStats(req);

      expect(statsService.getStats).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockStats);
    });

    it('propagates stats failures instead of returning fabricated data', async () => {
      vi.spyOn(statsService, 'getStats').mockRejectedValue(
        new Error('stats unavailable'),
      );

      await expect(
        controller.getMyStats({ user: { sub: 'user-1' } }),
      ).rejects.toThrow('stats unavailable');
    });
  });

  describe('getMyPerformanceReport', () => {
    const report: PerformanceReportResponse = {
      period: 'month',
      window: {
        start: '2026-10-11T12:00:00.000Z',
        end: '2026-11-10T12:00:00.000Z',
      },
      previous_window: {
        start: '2026-09-11T12:00:00.000Z',
        end: '2026-10-11T12:00:00.000Z',
      },
      metrics: [{ key: 'messages_sent', current: 4, previous: 2 }],
      badges_unlocked: [],
      streak_days: 3,
    };

    it('protects the report endpoint with Supabase authentication', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        StatsController.prototype.getMyPerformanceReport,
      ) as unknown[] | undefined;

      expect(guards).toContain(SupabaseAuthGuard);
    });

    it('marks the account-private report as uncacheable', () => {
      const headers = Reflect.getMetadata(
        '__headers__',
        StatsController.prototype.getMyPerformanceReport,
      ) as Array<{ name: string; value: string }> | undefined;

      expect(headers).toContainEqual({
        name: 'Cache-Control',
        value: 'private, no-store',
      });
    });

    it('builds the report for the guard-provided user id and requested period', async () => {
      vi.spyOn(reportService, 'getReport').mockResolvedValue(report);

      const result = await controller.getMyPerformanceReport(
        { user: { id: 'user-1' } },
        { period: 'month' },
      );

      expect(reportService.getReport).toHaveBeenCalledWith('user-1', 'month');
      expect(result).toEqual(report);
    });

    it('binds the report to the session id rather than another identity claim', async () => {
      vi.spyOn(reportService, 'getReport').mockResolvedValue(report);

      await controller.getMyPerformanceReport(
        { user: { id: 'user-1', sub: 'someone-else' } },
        { period: 'week' },
      );

      expect(reportService.getReport).toHaveBeenCalledWith('user-1', 'week');
    });

    it('refuses to build a report when the session carries no subject', async () => {
      await expect(
        controller.getMyPerformanceReport({ user: {} }, {}),
      ).rejects.toThrow('Missing authenticated user');

      expect(reportService.getReport).not.toHaveBeenCalled();
    });

    it('leaves the default period to the service when none is requested', async () => {
      vi.spyOn(reportService, 'getReport').mockResolvedValue(report);

      await controller.getMyPerformanceReport({ user: { id: 'user-1' } }, {});

      expect(reportService.getReport).toHaveBeenCalledWith('user-1', undefined);
    });

    it('propagates report failures instead of returning fabricated data', async () => {
      vi.spyOn(reportService, 'getReport').mockRejectedValue(
        new Error('report unavailable'),
      );

      await expect(
        controller.getMyPerformanceReport({ user: { id: 'user-1' } }, {}),
      ).rejects.toThrow('report unavailable');
    });
  });
});
