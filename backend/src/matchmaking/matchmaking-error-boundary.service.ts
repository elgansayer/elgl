import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  MatchmakingCrashReportPayload,
  MatchmakingCrashReport,
  MatchmakingErrorContext,
  ErrorBoundaryResult,
} from './interfaces/crash-report.interface';

const ERROR_BOUNDARY_SERVICE_NAME = 'matchmaking_error_boundary';

/** TTL (seconds) for matchmaking crash report Redis caching. */
const CRASH_CACHE_TTL = 3600;

@Injectable()
export class MatchmakingErrorBoundaryService {
  private readonly logger = new Logger(MatchmakingErrorBoundaryService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Reports a matchmaking crash / error with structured context for later analysis.
   * Stores in the `matchmaking_crash_reports` table and always logs at error level.
   */
  async reportCrash(
    payload: MatchmakingCrashReportPayload,
  ): Promise<MatchmakingCrashReport | null> {
    this.logger.error(
      {
        operation: payload.operation,
        service_name: payload.service_name,
        user_id: payload.user_id,
        error_type: payload.error_type,
        context: payload.context,
        stack_trace: payload.stack_trace,
      },
      `Matchmaking crash [${payload.service_name}]: ${payload.error_type} - ${payload.error_message}`,
    );

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('matchmaking_crash_reports')
        .insert({
          operation: payload.operation,
          service_name: payload.service_name,
          user_id: payload.user_id ?? null,
          error_type: payload.error_type,
          error_message: payload.error_message,
          stack_trace: payload.stack_trace ?? null,
          context: payload.context ?? null,
          acknowledged: false,
        })
        .select('*')
        .single();

      if (error || !data) {
        // Fallback: cache in Redis when DB is unavailable
        try {
          const redis = this.supabaseService.getRedisClient();
          const cacheKey = `crash:${payload.service_name}:${Date.now()}:${payload.error_type}`;
          await redis.set(
            cacheKey,
            JSON.stringify(payload),
            'EX',
            CRASH_CACHE_TTL,
          );
        } catch {
          // Swallow Redis fallback errors silently
        }

        this.logger.error(
          { db_error: error },
          'Failed to persist matchmaking crash report to database',
        );
        return null;
      }

      return {
        id: data.id,
        service_name: data.service_name,
        operation: data.operation,
        user_id: data.user_id ?? undefined,
        error_type: data.error_type,
        error_message: data.error_message,
        stack_trace: data.stack_trace ?? undefined,
        context: data.context ?? undefined,
        created_at: data.created_at,
        acknowledged: data.acknowledged ?? false,
        resolved_at: data.resolved_at ?? null,
      };
    } catch (persistError: unknown) {
      this.logger.error(
        {
          persist_error:
            persistError instanceof Error
              ? persistError.message
              : String(persistError),
        },
        'Exception while persisting matchmaking crash report',
      );
      return null;
    }
  }

  /**
   * Captures an error and reports it through the crash reporting pipeline.
   * Returns the error after reporting, so the caller can decide whether to rethrow.
   */
  async captureError(
    error: unknown,
    ctx: MatchmakingErrorContext,
  ): Promise<void> {
    const err =
      error instanceof Error ? error : new Error(String(error));

    const payload: MatchmakingCrashReportPayload = {
      operation: ctx.operation,
      service_name: ctx.service_name,
      user_id: ctx.user_id ?? null,
      error_type: error instanceof InternalServerErrorException
        ? 'InternalServerError'
        : err.constructor.name,
      error_message: err.message,
      stack_trace: err.stack ?? null,
      context: {
        params: ctx.params ?? null,
        tier: ctx.tier ?? null,
        degraded: ctx.degraded ?? false,
        fallback_reason: ctx.fallback_reason ?? null,
        latency_ms: ctx.latency_ms ?? null,
      },
    };

    await this.reportCrash(payload);
  }

  /**
   * Wraps an async operation with error boundary handling.
   * If the operation fails, the error is captured and reported,
   * and the fallback is executed.
   */
  async executeWithBoundary<T>(
    ctx: MatchmakingErrorContext,
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
  ): Promise<ErrorBoundaryResult<T>> {
    const startTime = Date.now();

    try {
      const data = await operation();
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        data,
        degraded: false,
        resolved_tier: ctx.tier,
        error_captured: false,
        ...(ctx.latency_ms ? {} : {}),
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      const enrichedCtx: MatchmakingErrorContext = {
        ...ctx,
        latency_ms: latencyMs,
        degraded: true,
        fallback_reason:
          error instanceof Error ? error.message : String(error),
      };

      await this.captureError(error, enrichedCtx);

      try {
        const fallbackData = await fallback();
        return {
          success: true,
          data: fallbackData,
          degraded: true,
          fallback_reason: enrichedCtx.fallback_reason,
          resolved_tier: ctx.tier,
          error_captured: true,
        };
      } catch (fallbackError: unknown) {
        const fallbackErr =
          fallbackError instanceof Error
            ? fallbackError
            : new Error(String(fallbackError));

        this.logger.error(
          {
            operation: ctx.operation,
            service_name: ctx.service_name,
            fallback_error: fallbackErr.message,
          },
          'Matchmaking error boundary: fallback also failed',
        );

        await this.captureError(fallbackErr, {
          ...ctx,
          operation: `${ctx.operation}_fallback`,
          tier: 'fallback_failure',
          degraded: true,
          fallback_reason: fallbackErr.message,
          latency_ms: Date.now() - startTime,
        });

        return {
          success: false,
          degraded: true,
          fallback_reason: `Primary and fallback both failed: ${enrichedCtx.fallback_reason}; fallback: ${fallbackErr.message}`,
          error_captured: true,
        };
      }
    }
  }

  /**
   * Wraps an async operation that should NOT fail silently.
   * Errors are captured and reported, then rethrown.
   */
  async executeOrThrow<T>(
    ctx: MatchmakingErrorContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      return await operation();
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      await this.captureError(error, {
        ...ctx,
        latency_ms: latencyMs,
      });
      throw error;
    }
  }

  /**
   * Lists unresolved crash reports for admin triage.
   */
  async listUnresolved(limit = 50): Promise<MatchmakingCrashReport[]> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('matchmaking_crash_reports')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        this.logger.error(
          { db_error: error },
          'Failed to retrieve matchmaking crash reports',
        );
        return [];
      }

      return (data as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          service_name: String(r.service_name ?? ''),
          operation: String(r.operation ?? ''),
          user_id: r.user_id ? String(r.user_id) : undefined,
          error_type: String(r.error_type ?? ''),
          error_message: String(r.error_message ?? ''),
          stack_trace: r.stack_trace ? String(r.stack_trace) : undefined,
          context: r.context as Record<string, unknown> | undefined,
          created_at: String(r.created_at ?? ''),
          acknowledged: Boolean(r.acknowledged),
          resolved_at: r.resolved_at ? String(r.resolved_at) : null,
        };
      });
    } catch (listError: unknown) {
      this.logger.error(
        {
          list_error:
            listError instanceof Error
              ? listError.message
              : String(listError),
        },
        'Exception while listing matchmaking crash reports',
      );
      return [];
    }
  }

  /**
   * Marks a crash report as acknowledged by an admin.
   */
  async acknowledgeReport(reportId: string): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase
        .from('matchmaking_crash_reports')
        .update({ acknowledged: true })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to acknowledge matchmaking crash report',
        );
        return false;
      }

      return true;
    } catch (ackError: unknown) {
      this.logger.error(
        {
          report_id: reportId,
          ack_error:
            ackError instanceof Error
              ? ackError.message
              : String(ackError),
        },
        'Exception while acknowledging matchmaking crash report',
      );
      return false;
    }
  }

  /**
   * Marks a crash report as resolved.
   */
  async resolveReport(reportId: string): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase
        .from('matchmaking_crash_reports')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to resolve matchmaking crash report',
        );
        return false;
      }

      return true;
    } catch (resolveError: unknown) {
      this.logger.error(
        {
          report_id: reportId,
          resolve_error:
            resolveError instanceof Error
              ? resolveError.message
              : String(resolveError),
        },
        'Exception while resolving matchmaking crash report',
      );
      return false;
    }
  }
}