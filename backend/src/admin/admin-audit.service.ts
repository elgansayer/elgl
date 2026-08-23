import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';

const MAX_CORRELATION_ID_LENGTH = 128;
const RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]+$/;

export interface AdminAuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  reason?: string | null;
  correlationId?: string;
  outcome?: 'success' | 'failed' | 'denied';
}

@Injectable()
export class AdminAuditService {
  private nextRetentionSweepAt = 0;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {}

  async record(
    adminUserId: string,
    event: AdminAuditEvent,
  ): Promise<void> {
    const correlationId = this.normalizeCorrelationId(event.correlationId);
    const metadata = this.sanitizeMetadata(event.metadata ?? {});
    const reason = event.reason?.trim().slice(0, 1000) || null;

    const client = this.supabase.getClient();
    const { error } = await client.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      action: event.action.slice(0, 120),
      resource_type: event.resourceType.slice(0, 120),
      resource_id: event.resourceId?.slice(0, 255) ?? null,
      metadata,
      reason,
      correlation_id: correlationId,
      outcome: event.outcome ?? 'success',
    });

    if (error) {
      this.logger.error(
        JSON.stringify({
          event: 'admin_audit_write_failed',
          correlationId,
          action: event.action.slice(0, 120),
          errorType: error.name ?? 'AuditWriteError',
        }),
      );
      throw new Error('Admin audit persistence failed');
    }

    this.logger.info(
      JSON.stringify({
        event: 'admin_audit_recorded',
        correlationId,
        action: event.action.slice(0, 120),
        resourceType: event.resourceType.slice(0, 120),
        outcome: event.outcome ?? 'success',
      }),
    );

    await this.maybeApplyRetention(client);
  }

  getRetentionDays(): number {
    const raw = this.config.get<string | number>('ADMIN_AUDIT_RETENTION_DAYS');
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 3650) {
      return 365;
    }
    return Math.trunc(parsed);
  }

  private normalizeCorrelationId(value: string | undefined): string {
    const candidate = value?.trim().slice(0, MAX_CORRELATION_ID_LENGTH);
    if (candidate && SAFE_CORRELATION_ID.test(candidate)) {
      return candidate;
    }
    return randomUUID();
  }

  private async maybeApplyRetention(client: SupabaseClient): Promise<void> {
    const now = Date.now();
    if (now < this.nextRetentionSweepAt) return;
    this.nextRetentionSweepAt = now + RETENTION_SWEEP_INTERVAL_MS;

    const rpcClient = client as unknown as {
      rpc?: (
        functionName: string,
      ) => Promise<{ data: unknown; error: unknown }>;
    };
    if (typeof rpcClient.rpc !== 'function') return;

    try {
      const { error } = await rpcClient.rpc('prune_admin_audit_events');
      if (error) {
        throw new Error('Admin audit retention RPC failed');
      }
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'admin_audit_retention_failed',
          errorType:
            error instanceof Error ? error.name : 'AuditRetentionError',
        }),
      );
    }
  }

  private sanitizeMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const normalizedKey = key.slice(0, 80);
      if (/token|secret|password|authorization|cookie/i.test(normalizedKey)) {
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        sanitized[normalizedKey] =
          typeof value === 'string' ? value.slice(0, 500) : value;
      }
    }
    return sanitized;
  }
}
