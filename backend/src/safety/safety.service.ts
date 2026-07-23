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

  async reportMessage(
    reporterId: string,
    dto: ReportUserDto,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: dto.reported_id,
        reason_category: 'message_content',
        description: dto.reason,
        context_url: dto.context_url || null,
        status: 'pending',
      });

    if (error) {
      throw new Error('Failed to submit report');
    }
  }

  async blockUser(
    blockerId: string,
    dto: BlockUserDto,
  ): Promise<{ success: boolean; blocked_id: string }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('blocks').insert({
      blocker_id: blockerId,
      blocked_id: dto.blocked_id,
    });

    if (error) {
      throw new Error(`Failed to block user: ${error.message}`);
    }

    this.logger.log(`User ${blockerId} blocked ${dto.blocked_id}`);
    return { success: true, blocked_id: dto.blocked_id };
  }

  async getBlockedIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (!response.data || response.data.length === 0) return [];
    const rows = response.data as UserBlockRow[];
    return rows.map((r) => r.blocked_id);
  }
}
