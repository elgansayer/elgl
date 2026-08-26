import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MAX_WEEKLY_CALL_LOG_ROWS = 10_000;
const MAX_CALL_DURATION_SECONDS = 24 * 60 * 60;

interface CallLogRow {
  duration_seconds: number | null;
  started_at: string;
}

interface QueryError {
  code?: unknown;
}

export interface MyStatsResponse {
  study_hours: { day: string; hours: number }[];
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(userId: string): Promise<MyStatsResponse> {
    const client = this.supabaseService.getClient();
    const startOfWeek = this.getStartOfWeekUtc(new Date());

    let queryResults: Awaited<
      ReturnType<typeof Promise.all<[PromiseLike<unknown>, PromiseLike<unknown>]>>
    >;

    try {
      queryResults = await Promise.all([
        client
          .from('call_logs')
          .select('duration_seconds, started_at')
          .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
          .gte('started_at', startOfWeek.toISOString())
          .not('duration_seconds', 'is', null)
          .limit(MAX_WEEKLY_CALL_LOG_ROWS),
        client
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', userId),
        client
          .from('moment_comments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('correction_payload', 'is', null),
        client
          .from('moments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);
    } catch (error: unknown) {
      this.failUnavailable('query_execution', error);
    }

    const [callResult, messageResult, correctionResult, momentResult] =
      queryResults as Array<{
        data?: unknown;
        count?: number | null;
        error?: QueryError | null;
      }>;

    this.assertQuerySucceeded('call_logs', callResult.error);
    this.assertQuerySucceeded('chat_messages', messageResult.error);
    this.assertQuerySucceeded('moment_comments', correctionResult.error);
    this.assertQuerySucceeded('moments', momentResult.error);

    const callLogs = Array.isArray(callResult.data)
      ? (callResult.data as CallLogRow[])
      : [];

    if (callLogs.length >= MAX_WEEKLY_CALL_LOG_ROWS) {
      this.failUnavailable('call_logs_result_limit');
    }

    const dailySeconds = new Map<string, number>();
    for (const log of callLogs) {
      const startedAt = new Date(log.started_at);
      const duration = this.normaliseDuration(log.duration_seconds);
      if (!Number.isFinite(startedAt.getTime()) || duration === 0) continue;

      const day = DAY_NAMES[startedAt.getUTCDay()];
      dailySeconds.set(day, (dailySeconds.get(day) ?? 0) + duration);
    }

    return {
      study_hours: DAY_NAMES.map((day) => ({
        day,
        hours: Math.round(((dailySeconds.get(day) ?? 0) / 3600) * 10) / 10,
      })),
      messages_sent: this.normaliseCount(messageResult.count),
      corrections_count: this.normaliseCount(correctionResult.count),
      moments_count: this.normaliseCount(momentResult.count),
    };
  }

  private getStartOfWeekUtc(now: Date): Date {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - now.getUTCDay(),
      ),
    );
  }

  private normaliseDuration(value: number | null): number {
    if (!Number.isFinite(value) || value === null || value <= 0) return 0;
    return Math.min(value, MAX_CALL_DURATION_SECONDS);
  }

  private normaliseCount(value: number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value < 0) {
      this.failUnavailable('invalid_count');
    }
    return value;
  }

  private assertQuerySucceeded(
    source: string,
    error: QueryError | null | undefined,
  ): void {
    if (error) this.failUnavailable(source, error);
  }

  private failUnavailable(source: string, error?: unknown): never {
    const errorCode = this.safeErrorCode(error);
    this.logger.error(
      `My Stats unavailable at ${source}${errorCode ? ` (${errorCode})` : ''}`,
    );
    throw new ServiceUnavailableException('Stats are temporarily unavailable');
  }

  private safeErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object' || !('code' in error)) return null;
    const code = (error as QueryError).code;
    return typeof code === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(code)
      ? code
      : null;
  }
}
