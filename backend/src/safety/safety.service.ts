import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';

export interface UserBlockRow {
  blocked_id: string;
}

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async reportUser(
    reporterId: string,
    dto: ReportUserDto,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseService.getClient();

    // Prevent self-reporting
    if (reporterId === dto.reported_id) {
      throw new Error('Cannot report yourself');
    }

    // Verify reported user exists
    const { data: reportedUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.reported_id)
      .single();

    if (userError || !reportedUser) {
      throw new NotFoundException('Reported user not found');
    }

    const {
      data,
      error,
    }: { data: { id: string } | null; error: PostgrestError | null } =
      await supabase
        .from('reports')
        .insert({
          reporter_id: reporterId,
          reported_user_id: dto.reported_id,
          reason_category: dto.reason_category,
          description: dto.description || null,
          context_url: dto.context_url || null,
          status: 'pending',
        })
        .select('id')
        .single();

    if (error) {
      this.logger.error(
        `Failed to submit report from ${reporterId} against ${dto.reported_id}: ${error.message}`,
      );
      throw new Error('Failed to submit report');
    }

    if (!data) {
      throw new Error('Failed to submit report: no data returned');
    }

    this.logger.log(
      `Report submitted: reporter=${reporterId}, reported=${dto.reported_id}, category=${dto.reason_category}`,
    );

    return { id: data.id };
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
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) {
      this.logger.error(`Failed to fetch blocked IDs: ${error.message}`);
      return [];
    }
    if (!data || data.length === 0) return [];
    const rows = data as UserBlockRow[];
    return rows.map((r) => r.blocked_id);
  }
}
