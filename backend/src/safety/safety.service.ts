import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';

export interface UserBlockRow {
  blocked_id: string;
}

export interface SafetyReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: string;
  created_at: string;
}

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async reportUser(
    reporterId: string,
    dto: ReportUserDto,
  ): Promise<SafetyReportRow> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('safety_reports')
      .insert({
        reporter_id: reporterId,
        reported_id: dto.reported_id,
        reason: dto.reason,
        details: dto.details ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to submit safety report: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    this.logger.log(
      `Safety report submitted by ${reporterId} against ${dto.reported_id} (${dto.reason})`,
    );
    return response.data as SafetyReportRow;
  }

  async blockUser(
    blockerId: string,
    dto: BlockUserDto,
  ): Promise<{ success: boolean; blocked_id: string }> {
    const supabase = this.supabaseService.getClient();
    await supabase.from('user_blocks').insert({
      blocker_id: blockerId,
      blocked_id: dto.blocked_id,
    });

    this.logger.log(`User ${blockerId} blocked ${dto.blocked_id}`);
    return { success: true, blocked_id: dto.blocked_id };
  }

  async getBlockedIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (!response.data || response.data.length === 0) return [];
    const rows = response.data as UserBlockRow[];
    return rows.map((r) => r.blocked_id);
  }
}
