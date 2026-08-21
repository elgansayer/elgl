import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

export interface ReadingEngineCrashPayload {
  operation: string;
  user_id?: string;
  resource_id?: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
}

export interface ReadingEngineCrashRecord extends ReadingEngineCrashPayload {
  id: string;
  created_at: string;
  acknowledged: boolean;
  resolved_at: string | null;
}

@Injectable()
export class ReadingEngineCrashReportService {
  private readonly logger = new Logger(ReadingEngineCrashReportService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Reports a reading-engine crash with structured context for later analysis.
   * Stores in `reading_engine_crash_reports` table and logs at error level.
   */
  async reportCrash(
    payload: ReadingEngineCrashPayload,
  ): Promise<ReadingEngineCrashRecord | null> {
    this.logger.error(
      {
        operation: payload.operation,
        user_id: payload.user_id,
        resource_id: payload.resource_id,
        error_type: payload.error_type,
        context: payload.context,
        stack_trace: payload.stack_trace,
      },
      `Reading Engine crash: ${payload.error_type} - ${payload.error_message}`,
    );

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('reading_engine_crash_reports')
        .insert({
          operation: payload.operation,
          user_id: payload.user_id ?? null,
          resource_id: payload.resource_id ?? null,
          error_type: payload.error_type,
          error_message: payload.error_message,
          stack_trace: payload.stack_trace ?? null,
          context: payload.context ?? null,
          acknowledged: false,
        })
        .select('*')
        .single();

      if (error || !data) {
        this.logger.error(
          { db_error: error },
          'Failed to persist reading engine crash report to database',
        );
        return null;
      }

      this.eventEmitter.emit('reading.crash_reported', {
        reportId: data.id,
        operation: payload.operation,
      });

      return {
        id: data.id,
        operation: data.operation,
        user_id: data.user_id ?? undefined,
        resource_id: data.resource_id ?? undefined,
        error_type: data.error_type,
        error_message: data.error_message,
        stack_trace: data.stack_trace ?? undefined,
        context: data.context ?? undefined,
        created_at: data.created_at,
        acknowledged: data.acknowledged ?? false,
        resolved_at: data.resolved_at ?? null,
      };
    } catch (persistError) {
      this.logger.error(
        { persist_error: String(persistError) },
        'Exception while persisting reading engine crash report',
      );
      return null;
    }
  }

  /**
   * Lists unresolved reading engine crash reports for admin triage.
   */
  async listUnresolved(limit = 50): Promise<ReadingEngineCrashRecord[]> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('reading_engine_crash_reports')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        this.logger.error(
          { db_error: error },
          'Failed to retrieve reading engine crash reports',
        );
        return [];
      }

      return (data as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          operation: String(r.operation ?? ''),
          user_id: r.user_id ? String(r.user_id) : undefined,
          resource_id: r.resource_id ? String(r.resource_id) : undefined,
          error_type: String(r.error_type ?? ''),
          error_message: String(r.error_message ?? ''),
          stack_trace: r.stack_trace ? String(r.stack_trace) : undefined,
          context: r.context as Record<string, unknown> | undefined,
          created_at: String(r.created_at ?? ''),
          acknowledged: Boolean(r.acknowledged),
          resolved_at: r.resolved_at ? String(r.resolved_at) : null,
        };
      });
    } catch (listError) {
      this.logger.error(
        { list_error: String(listError) },
        'Exception while listing reading engine crash reports',
      );
      return [];
    }
  }

  /**
   * Acknowledges a crash report for admin review.
   */
  async acknowledgeReport(reportId: string): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();

      const { error } = await supabase
        .from('reading_engine_crash_reports')
        .update({ acknowledged: true })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to acknowledge reading engine crash report',
        );
        return false;
      }

      return true;
    } catch (ackError) {
      this.logger.error(
        { report_id: reportId, ack_error: String(ackError) },
        'Exception while acknowledging reading engine crash report',
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
        .from('reading_engine_crash_reports')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to resolve reading engine crash report',
        );
        return false;
      }

      return true;
    } catch (resolveError) {
      this.logger.error(
        { report_id: reportId, resolve_error: String(resolveError) },
        'Exception while resolving reading engine crash report',
      );
      return false;
    }
  }
}
