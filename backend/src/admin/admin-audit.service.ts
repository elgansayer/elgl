import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AdminActionReasonCode,
  normalizeAdminOperatorNote,
} from './admin-action-reasons';
import { AdminCapability } from './admin-capabilities';

export type AdminAuditOutcome = 'success' | 'denied' | 'failed';

export interface AdminAuditEventInput {
  actorUserId: string;
  action: string;
  capabilityKey?: AdminCapability;
  targetType?: string;
  targetId?: string;
  reasonCode?: AdminActionReasonCode;
  operatorNote?: string;
  outcome: AdminAuditOutcome;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

const ALLOWED_METADATA_KEYS = new Set([
  'resultCount',
  'source',
  'operation',
  'page',
  'pageSize',
  'total',
]);
const MAX_CORRELATION_ID_LENGTH = 128;
const MAX_METADATA_STRING_LENGTH = 128;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]+$/;
const SAFE_TARGET_ID = /^[A-Za-z0-9_-]{1,200}$/;
const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);
  private nextRetentionSweepAt = 0;

  constructor(private readonly supabaseService: SupabaseService) {}

  async record(input: AdminAuditEventInput): Promise<void> {
    const correlationId = this.normalizeCorrelationId(input.correlationId);
    const metadata = this.sanitizeMetadata(input.metadata ?? {});
    const operatorNote = normalizeAdminOperatorNote(input.operatorNote);
    const targetId =
      input.targetId && SAFE_TARGET_ID.test(input.targetId)
        ? input.targetId
        : null;

    // The handwritten Database type currently lags newly-added admin tables.
    // Keep this escape hatch local to audit persistence until generated Supabase
    // database types replace the manual schema definition.
    const client =
      this.supabaseService.getClient() as unknown as SupabaseClient;
    const { error } = await client.from('admin_audit_events').insert({
      actor_user_id: input.actorUserId,
      action: input.action,
      capability_key: input.capabilityKey ?? null,
      target_type: input.targetType ?? null,
      target_id: targetId,
      reason_code: input.reasonCode ?? null,
      operator_note: operatorNote,
      outcome: input.outcome,
      correlation_id: correlationId,
      metadata,
    });

    if (error) {
      this.logger.error(
        JSON.stringify({
          event: 'admin_audit_persistence_failed',
          action: input.action,
          capabilityKey: input.capabilityKey ?? null,
          outcome: input.outcome,
          correlationId,
          errorType:
            error instanceof Error ? error.name : 'AuditPersistenceError',
        }),
      );
      throw error;
    }

    await this.maybeApplyRetention(client);
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
      if (!ALLOWED_METADATA_KEYS.has(key)) continue;
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, MAX_METADATA_STRING_LENGTH);
        continue;
      }
      if (
        value === null ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
