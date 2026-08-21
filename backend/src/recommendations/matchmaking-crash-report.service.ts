import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface MatchmakingCrashReportPayload {
  operation: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  circuit_breaker_open?: boolean;
  degraded_tier?: string;
}

export interface MatchmakingCrashReport extends MatchmakingCrashReportPayload {
  id: string;
  created_at: string;
  acknowledged: boolean;
  resolved_at?: string | null;
}

@Injectable()
export class MatchmakingCrashReportService {
  private readonly logger = new Logger(MatchmakingCrashReportService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async reportCrash(
    payload: MatchmakingCrashReportPayload,
  ): Promise<MatchmakingCrashReport | null> {
    this.logger.error(
      {
        operation: payload.operation,
        user_id: payload.user_id,
        error_type: payload.error_type,
        context: payload.context,
        circuit_breaker_open: payload.circuit_breaker_open,
        degraded_tier: payload.degraded_tier,
      },
      `Matchmaking crash: ${payload.error_type} - ${payload.error_message}`,
    );

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('matchmaking_crash_reports')
        .insert({
          operation: payload.operation,
          user_id: payload.user_id ?? null,
          error_type: payload.error_type,
          error_message: payload.error_message,
          stack_trace: payload.stack_trace ?? null,
          context: payload.context ?? null,
          circuit_breaker_open: payload.circuit_breaker_open ?? false,
          degraded_tier: payload.degraded_tier ?? null,
          acknowledged: false,
        })
        .select('*')
        .single();

      if (error || !data) {
        this.logger.error(
          { db_error: error },
          'Failed to persist matchmaking crash report to database',
        );
        return null;
      }

      return {
        id: data.id,
        operation: data.operation,
        user_id: data.user_id ?? undefined,
        error_type: data.error_type,
        error_message: data.error_message,
        stack_trace: data.stack_trace ?? undefined,
        context: data.context ?? undefined,
        circuit_breaker_open: data.circuit_breaker_open ?? false,
        degraded_tier: data.degraded_tier ?? undefined,
        created_at: data.created_at,
        acknowledged: data.acknowledged ?? false,
        resolved_at: data.resolved_at ?? null,
      };
    } catch (persistError) {
      this.logger.error(
        { persist_error: String(persistError) },
        'Exception while persisting matchmaking crash report',
      );
      return null;
    }
  }

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

        const id = r['id'];
        const operation = r['operation'];
        const userId = r['user_id'];
        const errorType = r['error_type'];
        const errorMessage = r['error_message'];
        const stackTrace = r['stack_trace'];
        const contextVal = r['context'];
        const circuitOpen = r['circuit_breaker_open'];
        const degradedTierVal = r['degraded_tier'];
        const createdAt = r['created_at'];
        const ackVal = r['acknowledged'];
        const resolvedAtVal = r['resolved_at'];

        const resolvedId =
          typeof id === 'string'
            ? id
            : typeof id === 'number'
              ? String(id)
              : '';
        const resolvedOperation =
          typeof operation === 'string' ? operation : '';
        const resolvedUserId = typeof userId === 'string' ? userId : undefined;
        const resolvedErrorType =
          typeof errorType === 'string' ? errorType : '';
        const resolvedErrorMessage =
          typeof errorMessage === 'string' ? errorMessage : '';
        const resolvedStackTrace =
          typeof stackTrace === 'string' ? stackTrace : undefined;
        const resolvedContext =
          typeof contextVal === 'object' && contextVal !== null
            ? (contextVal as Record<string, unknown>)
            : undefined;
        const resolvedCircuitOpen =
          typeof circuitOpen === 'boolean' ? circuitOpen : false;
        const resolvedDegradedTier =
          typeof degradedTierVal === 'string' ? degradedTierVal : undefined;
        const resolvedCreatedAt =
          typeof createdAt === 'string'
            ? createdAt
            : typeof createdAt === 'number'
              ? String(createdAt)
              : '';
        const resolvedAcknowledged =
          typeof ackVal === 'boolean' ? ackVal : false;
        const resolvedResolvedAt =
          typeof resolvedAtVal === 'string' ? resolvedAtVal : null;

        return {
          id: resolvedId,
          operation: resolvedOperation,
          user_id: resolvedUserId,
          error_type: resolvedErrorType,
          error_message: resolvedErrorMessage,
          stack_trace: resolvedStackTrace,
          context: resolvedContext,
          circuit_breaker_open: resolvedCircuitOpen,
          degraded_tier: resolvedDegradedTier,
          created_at: resolvedCreatedAt,
          acknowledged: resolvedAcknowledged,
          resolved_at: resolvedResolvedAt,
        };
      });
    } catch (listError) {
      this.logger.error(
        { list_error: String(listError) },
        'Exception while listing matchmaking crash reports',
      );
      return [];
    }
  }

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
    } catch (ackError) {
      this.logger.error(
        { report_id: reportId, ack_error: String(ackError) },
        'Exception while acknowledging matchmaking crash report',
      );
      return false;
    }
  }

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
    } catch (resolveError) {
      this.logger.error(
        { report_id: reportId, resolve_error: String(resolveError) },
        'Exception while resolving matchmaking crash report',
      );
      return false;
    }
  }

  async getStats(): Promise<{
    total: number;
    unresolved: number;
    by_tier: Record<string, number>;
    by_operation: Record<string, number>;
  }> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('matchmaking_crash_reports')
        .select('*');

      if (error || !data) {
        return {
          total: 0,
          unresolved: 0,
          by_tier: {},
          by_operation: {},
        };
      }

      const rows = data as unknown[] as Record<string, unknown>[];
      const unresolved = rows.filter((r) => r['resolved_at'] == null).length;

      const byTier: Record<string, number> = {};
      const byOperation: Record<string, number> = {};

      for (const row of rows) {
        const tierVal = row['degraded_tier'];
        const tier = typeof tierVal === 'string' ? tierVal : 'none';
        byTier[tier] = (byTier[tier] ?? 0) + 1;

        const opVal = row['operation'];
        const op = typeof opVal === 'string' ? opVal : 'unknown';
        byOperation[op] = (byOperation[op] ?? 0) + 1;
      }

      return {
        total: rows.length,
        unresolved,
        by_tier: byTier,
        by_operation: byOperation,
      };
    } catch (statsError) {
      this.logger.error(
        { stats_error: String(statsError) },
        'Exception while computing matchmaking crash stats',
      );
      return { total: 0, unresolved: 0, by_tier: {}, by_operation: {} };
    }
  }
}
