import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AchievementsService } from '../achievements/achievements.service';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  PerformanceReportResponse,
  PerformanceReportWindow,
  ReportPeriod,
} from './performance-report.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<ReportPeriod, number> = { week: 7, month: 30 };
const MAX_CALL_LOG_ROWS = 10_000;
const MAX_CALL_DURATION_SECONDS = 24 * 60 * 60;
const UNAVAILABLE_MESSAGE = 'Performance report is temporarily unavailable';

interface QueryError {
  code?: unknown;
}

interface CountResult {
  count: number | null;
  error: QueryError | null;
}

interface CallLogRow {
  duration_seconds: number | null;
  started_at: string;
}

interface ReportWindows {
  current: PerformanceReportWindow;
  previous: PerformanceReportWindow;
}

interface WindowTotals {
  current: number;
  previous: number;
}

/**
 * Builds the caller's performance report: activity totals for the latest
 * rolling window next to the equally long window before it, the badges
 * unlocked in the latest window and the persisted study streak.
 *
 * Every source is read from persisted data for the verified caller only, with
 * bounded queries. If any source is unavailable the whole report fails closed
 * rather than mixing fresh and missing figures.
 */
@Injectable()
export class PerformanceReportService {
  private readonly logger = new Logger(PerformanceReportService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async getReport(
    userId: string,
    period: ReportPeriod = 'week',
  ): Promise<PerformanceReportResponse> {
    const windows = this.buildWindows(period, new Date());
    const client = this.supabaseService.getClient();
    // lesson_progress is not in the generated Database types yet.
    const untypedClient: SupabaseClient = client;

    const [
      messages,
      corrections,
      moments,
      lessons,
      studySeconds,
      streakDays,
      badges,
    ] = await Promise.all([
      this.countByWindow('chat_messages', windows, (window) =>
        client
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', userId)
          .gte('created_at', window.start)
          .lt('created_at', window.end),
      ),
      this.countByWindow('moment_comments', windows, (window) =>
        client
          .from('moment_comments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('correction_payload', 'is', null)
          .gte('created_at', window.start)
          .lt('created_at', window.end),
      ),
      this.countByWindow('moments', windows, (window) =>
        client
          .from('moments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', window.start)
          .lt('created_at', window.end),
      ),
      this.countByWindow('lesson_progress', windows, (window) =>
        untypedClient
          .from('lesson_progress')
          .select('lesson_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('completed', true)
          .gte('completed_at', window.start)
          .lt('completed_at', window.end),
      ),
      this.readStudySeconds(client, userId, windows),
      this.readStreakDays(client, userId),
      this.achievementsService.getUnlockedBetween(
        userId,
        new Date(windows.current.start),
        new Date(windows.current.end),
      ),
    ]);

    return {
      period,
      window: windows.current,
      previous_window: windows.previous,
      metrics: [
        {
          key: 'study_hours',
          current: this.toHours(studySeconds.current),
          previous: this.toHours(studySeconds.previous),
        },
        { key: 'messages_sent', ...messages },
        { key: 'corrections_made', ...corrections },
        { key: 'moments_posted', ...moments },
        { key: 'lessons_completed', ...lessons },
      ],
      badges_unlocked: badges,
      streak_days: streakDays,
    };
  }

  private buildWindows(period: ReportPeriod, now: Date): ReportWindows {
    const lengthMs = PERIOD_DAYS[period] * DAY_MS;
    const end = now.getTime();
    const start = end - lengthMs;
    const previousStart = start - lengthMs;
    return {
      current: {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      },
      previous: {
        start: new Date(previousStart).toISOString(),
        end: new Date(start).toISOString(),
      },
    };
  }

  private async countByWindow(
    source: string,
    windows: ReportWindows,
    query: (window: PerformanceReportWindow) => PromiseLike<CountResult>,
  ): Promise<WindowTotals> {
    const [current, previous] = await Promise.all([
      this.readCount(source, () => query(windows.current)),
      this.readCount(source, () => query(windows.previous)),
    ]);
    return { current, previous };
  }

  private async readCount(
    source: string,
    query: () => PromiseLike<CountResult>,
  ): Promise<number> {
    let result: CountResult;
    try {
      result = await query();
    } catch (error: unknown) {
      this.failUnavailable(source, error);
    }
    if (result.error) {
      this.failUnavailable(source, result.error);
    }
    return this.normaliseCount(result.count);
  }

  /** Completed call seconds per window, from one bounded call-log read. */
  private async readStudySeconds(
    client: ReturnType<SupabaseService['getClient']>,
    userId: string,
    windows: ReportWindows,
  ): Promise<WindowTotals> {
    let result: { data: CallLogRow[] | null; error: QueryError | null };
    try {
      result = await client
        .from('call_logs')
        .select('duration_seconds, started_at')
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .gte('started_at', windows.previous.start)
        .lt('started_at', windows.current.end)
        .not('duration_seconds', 'is', null)
        .limit(MAX_CALL_LOG_ROWS)
        .returns<CallLogRow[]>();
    } catch (error: unknown) {
      this.failUnavailable('call_logs', error);
    }
    if (result.error) {
      this.failUnavailable('call_logs', result.error);
    }

    const rows = result.data ?? [];
    if (rows.length >= MAX_CALL_LOG_ROWS) {
      // A truncated read would understate study time, so refuse to report it.
      this.failUnavailable('call_logs_result_limit');
    }

    const currentStart = Date.parse(windows.current.start);
    const previousStart = Date.parse(windows.previous.start);
    const totals: WindowTotals = { current: 0, previous: 0 };
    for (const row of rows) {
      const startedAt = Date.parse(row.started_at);
      const duration = this.normaliseDuration(row.duration_seconds);
      if (!Number.isFinite(startedAt) || duration === 0) continue;
      if (startedAt >= currentStart) {
        totals.current += duration;
      } else if (startedAt >= previousStart) {
        totals.previous += duration;
      }
    }
    return totals;
  }

  private async readStreakDays(
    client: ReturnType<SupabaseService['getClient']>,
    userId: string,
  ): Promise<number> {
    let result: {
      data: { study_streak_days: number | null } | null;
      error: QueryError | null;
    };
    try {
      result = await client
        .from('users')
        .select('study_streak_days')
        .eq('id', userId)
        .maybeSingle<{ study_streak_days: number | null }>();
    } catch (error: unknown) {
      this.failUnavailable('streak', error);
    }
    if (result.error) {
      this.failUnavailable('streak', result.error);
    }
    return this.normaliseCount(result.data?.study_streak_days);
  }

  private toHours(seconds: number): number {
    return Math.round((seconds / 3600) * 10) / 10;
  }

  private normaliseDuration(value: number | null): number {
    if (value === null || !Number.isFinite(value) || value <= 0) return 0;
    return Math.min(value, MAX_CALL_DURATION_SECONDS);
  }

  private normaliseCount(value: number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value < 0) {
      this.failUnavailable('invalid_count');
    }
    return value;
  }

  private failUnavailable(source: string, error?: unknown): never {
    const code = this.safeErrorCode(error);
    this.logger.error(
      `performance_report.${source}_failed${code ? ` code=${code}` : ''}`,
    );
    throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
  }

  /** Only a short provider error code is ever logged, never a message. */
  private safeErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }
    const { code } = error;
    return typeof code === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(code)
      ? code
      : null;
  }
}
