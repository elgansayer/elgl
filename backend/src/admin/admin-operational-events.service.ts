import { BadRequestException, Injectable } from '@nestjs/common';
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

export interface AdminOperationalEventInput {
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  correlationId?: string;
  source?: string;
}

@Injectable()
export class AdminOperationalEventsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async record(input: AdminOperationalEventInput): Promise<void> {
    const category = input.category.trim().slice(0, 80);
    const message = input.message.trim().slice(0, 500);
    const correlationId = input.correlationId?.trim().slice(0, 128) || null;
    const source = input.source?.trim().slice(0, 80) || null;

    if (!category || !message) {
      throw new Error('Operational event category and message are required');
    }

    const payload = {
      severity: input.severity,
      category,
      message,
      correlation_id: correlationId,
      source,
    };
    // The migration exists before the local Supabase Database type is regenerated.
    // Keep the cast at this schema boundary instead of weakening the service types.
    const { error } = await this.supabaseService
      .getClient()
      .from('admin_operational_events')
      .insert(payload as never);

    if (error) throw error;
  }

  async list(
    query: AdminOperationalEventsQueryDto,
  ): Promise<AdminOperationalEventsResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
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
      .from('admin_operational_events')
      .select(
        'id, severity, category, message, correlation_id, source, created_at',
        { count: 'exact' },
      );

    if (query.severity) request = request.eq('severity', query.severity);
    if (query.category?.trim())
      request = request.eq('category', query.category.trim());
    if (query.source?.trim())
      request = request.eq('source', query.source.trim());
    if (query.correlationId?.trim())
      request = request.eq('correlation_id', query.correlationId.trim());
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
