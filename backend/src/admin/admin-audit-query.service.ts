import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';

export interface AdminAuditEventSummary {
  id: string;
  actor_user_id: string;
  action: string;
  capability_key: string | null;
  target_type: string | null;
  target_id: string | null;
  reason_code: string | null;
  outcome: 'success' | 'denied' | 'failed';
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminAuditListResult {
  events: AdminAuditEventSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const AUDIT_COLUMNS =
  'id, actor_user_id, action, capability_key, target_type, target_id, reason_code, outcome, correlation_id, metadata, created_at';

@Injectable()
export class AdminAuditQueryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(query: AdminAuditQueryDto): Promise<AdminAuditListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (
      query.startTime &&
      query.endTime &&
      Date.parse(query.startTime) > Date.parse(query.endTime)
    ) {
      throw new BadRequestException(
        'startTime must be before or equal to endTime',
      );
    }

    let request = this.supabaseService
      .getClient()
      .from('admin_audit_events')
      .select(AUDIT_COLUMNS, { count: 'exact' });

    if (query.action) request = request.eq('action', query.action);
    if (query.outcome) request = request.eq('outcome', query.outcome);
    if (query.capabilityKey)
      request = request.eq('capability_key', query.capabilityKey);
    if (query.reasonCode) request = request.eq('reason_code', query.reasonCode);
    if (query.actorUserId)
      request = request.eq('actor_user_id', query.actorUserId);
    if (query.targetType) request = request.eq('target_type', query.targetType);
    if (query.targetId) request = request.eq('target_id', query.targetId);
    if (query.correlationId) {
      request = request.eq('correlation_id', query.correlationId);
    }
    if (query.startTime) request = request.gte('created_at', query.startTime);
    if (query.endTime) request = request.lte('created_at', query.endTime);

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      events: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}
