import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CrashReportPayload,
  CrashReport,
} from './interfaces/crash-report.interface';

@Injectable()
export class CrashReportService {
  constructor(
    @InjectPinoLogger(CrashReportService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Reports a crash / error with structured context for later analysis.
   * Stores in the `escrow_crash_reports` table and always logs at error level.
   */
  async reportCrash(payload: CrashReportPayload): Promise<CrashReport | null> {
    // Always log the crash with structured context
    this.logger.error(
      {
        operation: payload.operation,
        escrow_id: payload.escrow_id,
        user_id: payload.user_id,
        error_type: payload.error_type,
        context: payload.context,
        stack_trace: payload.stack_trace,
      },
      `Escrow crash: ${payload.error_type} - ${payload.error_message}`,
    );

    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('escrow_crash_reports')
        .insert({
          operation: payload.operation,
          escrow_id: payload.escrow_id ?? null,
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
        this.logger.error(
          { db_error: error },
          'Failed to persist escrow crash report to database',
        );
        return null;
      }

      return {
        id: data.id,
        operation: data.operation,
        escrow_id: data.escrow_id ?? undefined,
        user_id: data.user_id ?? undefined,
        error_type: data.error_type,
        error_message: data.error_message,
        stack_trace: data.stack_trace ?? undefined,
        context: data.context ?? undefined,
        created_at: data.created_at,
        acknowledged: data.acknowledged ?? false,
        resolved_at: data.resolved_at ?? undefined,
      };
    } catch (persistError) {
      this.logger.error(
        { persist_error: String(persistError) },
        'Exception while persisting escrow crash report',
      );
      return null;
    }
  }

  /**
   * Lists unresolved crash reports for admin triage.
   */
  async listUnresolved(limit = 50): Promise<CrashReport[]> {
    try {
      const supabase = this.supabaseService.getClient();

      const { data, error } = await supabase
        .from('escrow_crash_reports')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        this.logger.error(
          { db_error: error },
          'Failed to retrieve escrow crash reports',
        );
        return [];
      }

      return (data as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          operation: String(r.operation ?? ''),
          escrow_id: r.escrow_id ? String(r.escrow_id) : undefined,
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
    } catch (listError) {
      this.logger.error(
        { list_error: String(listError) },
        'Exception while listing escrow crash reports',
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
        .from('escrow_crash_reports')
        .update({ acknowledged: true })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to acknowledge crash report',
        );
        return false;
      }

      return true;
    } catch (ackError) {
      this.logger.error(
        { report_id: reportId, ack_error: String(ackError) },
        'Exception while acknowledging crash report',
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
        .from('escrow_crash_reports')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) {
        this.logger.error(
          { report_id: reportId, db_error: error },
          'Failed to resolve crash report',
        );
        return false;
      }

      return true;
    } catch (resolveError) {
      this.logger.error(
        { report_id: reportId, resolve_error: String(resolveError) },
        'Exception while resolving crash report',
      );
      return false;
    }
  }
}
