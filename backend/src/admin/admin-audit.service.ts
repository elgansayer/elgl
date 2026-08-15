import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminCapability } from './admin-capabilities';

export type AdminAuditOutcome = 'success' | 'denied' | 'failed';

export interface AdminAuditEventInput {
  actorUserId: string;
  action: string;
  capabilityKey?: AdminCapability;
  targetType?: string;
  targetId?: string;
  reasonCode?: string;
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

@Injectable()
export class AdminAuditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async record(input: AdminAuditEventInput): Promise<void> {
    const correlationId = input.correlationId?.trim() || randomUUID();
    const metadata = this.sanitizeMetadata(input.metadata ?? {});
    const { error } = await this.supabaseService
      .getClient()
      .from('admin_audit_events')
      .insert({
        actor_user_id: input.actorUserId,
        action: input.action,
        capability_key: input.capabilityKey ?? null,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        reason_code: input.reasonCode ?? null,
        outcome: input.outcome,
        correlation_id: correlationId,
        metadata,
      });

    if (error) {
      throw error;
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (!ALLOWED_METADATA_KEYS.has(key)) continue;
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
