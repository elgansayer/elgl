import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { PerformanceReportService } from '../src/stats/performance-report.service';
import { StatsController } from '../src/stats/stats.controller';
import { StatsService } from '../src/stats/stats.service';

describe('Performance report E2E', () => {
  let app: INestApplication;
  const getReport = vi.fn();
  const getStats = vi.fn();

  const report = {
    period: 'week',
    window: {
      start: '2026-11-03T12:00:00.000Z',
      end: '2026-11-10T12:00:00.000Z',
    },
    previous_window: {
      start: '2026-10-27T12:00:00.000Z',
      end: '2026-11-03T12:00:00.000Z',
    },
    metrics: [{ key: 'messages_sent', current: 12, previous: 5 }],
    badges_unlocked: [
      {
        code: 'first_moment',
        name: 'First Moment',
        description: 'Share your first Moment.',
        unlocked_at: '2026-11-09T09:00:00.000Z',
      },
    ],
    streak_days: 4,
  };

  beforeEach(async () => {
    getReport.mockReset();
    getReport.mockResolvedValue(report);
    getStats.mockReset();
    getStats.mockResolvedValue({ messages_sent: 1 });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [
        { provide: StatsService, useValue: { getStats } },
        { provide: PerformanceReportService, useValue: { getReport } },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          const httpRequest = context.switchToHttp().getRequest();
          if (!httpRequest.headers.authorization) {
            throw new UnauthorizedException('Missing authentication token');
          }
          httpRequest.user = { sub: 'user-1' };
          return true;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Same options as src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const fetchReport = (query = '') =>
    request(app.getHttpServer())
      .get(`/stats/me/report${query}`)
      .set('Authorization', 'Bearer token');

  it('requires authentication and never reaches the report service without it', async () => {
    await request(app.getHttpServer()).get('/stats/me/report').expect(401);

    expect(getReport).not.toHaveBeenCalled();
  });

  it('returns the caller report uncached, defaulting the period to the service', async () => {
    const response = await fetchReport().expect(200);

    expect(response.body).toEqual(report);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(getReport).toHaveBeenCalledWith('user-1', undefined);
  });

  it('passes the requested period through', async () => {
    await fetchReport('?period=month').expect(200);

    expect(getReport).toHaveBeenCalledWith('user-1', 'month');
  });

  it.each(['year', 'WEEK', '', 'week;drop'])(
    'rejects the unsupported period %j with a 400',
    async (period) => {
      await fetchReport(`?period=${encodeURIComponent(period)}`).expect(400);

      expect(getReport).not.toHaveBeenCalled();
    },
  );

  it('rejects a caller-supplied user id so reports are always self-only', async () => {
    await fetchReport('?period=week&userId=someone-else').expect(400);

    expect(getReport).not.toHaveBeenCalled();
  });

  it('returns a stable 503 instead of fabricated figures when a source is down', async () => {
    getReport.mockRejectedValue(
      new ServiceUnavailableException(
        'Performance report is temporarily unavailable',
      ),
    );

    const response = await fetchReport().expect(503);

    expect(response.body.message).toBe(
      'Performance report is temporarily unavailable',
    );
  });

  it('keeps the dashboard route separate from the report route', async () => {
    await request(app.getHttpServer())
      .get('/stats/me')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(getStats).toHaveBeenCalledWith('user-1');
    expect(getReport).not.toHaveBeenCalled();
  });
});
