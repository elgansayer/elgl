import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsQueryDto } from './dto/admin-operational-events-query.dto';

export interface AdminOperationalEvent {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  correlation_id: string | null;
  source: string | null;
  created_at: string;
}

export interface AdminOperationalEventsResult {
  events: AdminOperationalEvent[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminOperationalEventsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(query: AdminOperationalEventsQueryDto): Promise<AdminOperationalEventsResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = this.supabaseService
      .getClient()
      .from('admin_operational_events')
      .select('id, severity, category, message, correlation_id, source, created_at', { count: 'exact' });

    if (query.severity) request = request.eq('severity', query.severity);
    if (query.category?.trim()) request = request.eq('category', query.category.trim());
    if (query.correlationId?.trim()) request = request.eq('correlation_id', query.correlationId.trim());

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      events: (data ?? []) as AdminOperationalEvent[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}
