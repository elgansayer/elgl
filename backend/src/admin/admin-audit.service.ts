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
]);
const MAX_CORRELATION_ID_LENGTH = 128;
const MAX_METADATA_STRING_LENGTH = 128;

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async record(input: AdminAuditEventInput): Promise<void> {
    const suppliedCorrelationId = input.correlationId?.trim();
    const correlationId = suppliedCorrelationId
      ? suppliedCorrelationId.slice(0, MAX_CORRELATION_ID_LENGTH)
      : randomUUID();
    const metadata = this.sanitizeMetadata(input.metadata ?? {});
    const operatorNote = normalizeAdminOperatorNote(input.operatorNote);

    // The handwritten Database type currently lags newly-added admin tables.
    // Keep this escape hatch local to the audit insert until generated Supabase
    // database types replace the manual schema definition.
    const client =
      this.supabaseService.getClient() as unknown as SupabaseClient;
    const { error } = await client.from('admin_audit_events').insert({
      actor_user_id: input.actorUserId,
      action: input.action,
      capability_key: input.capabilityKey ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
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
