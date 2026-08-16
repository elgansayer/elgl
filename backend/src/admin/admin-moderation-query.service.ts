import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminReportsQueryDto } from './dto/admin-reports-query.dto';
import {
  AdminReportEntry,
  AdminReportsListResult,
} from './interfaces/admin-user.interface';

@Injectable()
export class AdminModerationQueryService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(query: AdminReportsQueryDto): Promise<AdminReportsListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = this.supabaseService
      .getClient()
      .from('reports')
      .select(
        'id, reporter_id, reported_user_id, reason_category, description, status, created_at, reported:reported_user_id ( display_name ), reporter:reporter_id ( display_name )',
        { count: 'exact' },
      );

    if (query.status?.trim()) request = request.eq('status', query.status.trim());
    if (query.reasonCategory?.trim()) {
      request = request.eq('reason_category', query.reasonCategory.trim());
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;

    const reports: AdminReportEntry[] = (data ?? []).map(
      (row: Record<string, unknown>) => {
        const reported = row.reported as { display_name?: string } | null;
        const reporter = row.reporter as { display_name?: string } | null;
        return {
          id: row.id as string,
          reporter_id: row.reporter_id as string | null,
          reported_user_id: row.reported_user_id as string,
          reason_category: row.reason_category as string,
          description: row.description as string | null,
          status: row.status as string,
          reported_name: reported?.display_name ?? null,
          reporter_name: reporter?.display_name ?? null,
          created_at: row.created_at as string,
        };
      },
    );

    return { reports, total: count ?? 0, page, pageSize };
  }
}
