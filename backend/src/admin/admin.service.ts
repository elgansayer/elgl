import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService, type UsersRow } from '../supabase/supabase.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';

const SUMMARY_COLUMNS =
  'id, display_name, avatar_url, native_languages, target_languages, is_vip, vip_tier, is_admin, coins_balance, study_streak_days, last_active_at, created_at, is_banned, warning_count';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async listUsers(query: AdminUserQueryDto): Promise<AdminUserListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = this.supabaseService.getClient();
    let request = supabase
      .from('users')
      .select(SUMMARY_COLUMNS, { count: 'exact' });

    if (query.search) {
      request = request.ilike('display_name', `%${query.search}%`);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(`Failed to list admin users: ${error.message}`);
      return { users: [], total: 0, page, pageSize };
    }

    return {
      users: (data ?? []) as unknown as AdminUserSummary[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async setVipStatus(
    userId: string,
    dto: ToggleVipDto,
  ): Promise<AdminUserSummary> {
    const supabase = this.supabaseService.getClient();
    const updatePayload: Partial<UsersRow> = { is_vip: dto.is_vip };
    if (dto.vip_tier !== undefined) {
      updatePayload.vip_tier = dto.vip_tier;
    } else if (!dto.is_vip) {
      updatePayload.vip_tier = 'free';
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select(SUMMARY_COLUMNS)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Unable to update VIP status for user ${userId}`,
      );
    }

    return data;
  }

  async getLoginHistory(userId: string): Promise<LoginHistoryEntry[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('login_history')
      .select('id, user_id, ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.warn(
        `Failed to fetch login history for user ${userId}: ${error.message}`,
      );
      return [];
    }

    return data ?? [];
  }

  async banUser(targetUserId: string, adminUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ is_banned: true })
      .eq('id', targetUserId);

    if (error) {
      this.logger.error(`Failed to ban user ${targetUserId}: ${error.message}`);
      throw new NotFoundException(`Unable to ban user ${targetUserId}`);
    }

    this.logger.log(`User ${targetUserId} banned by admin ${adminUserId}`);
  }

  async warnUser(targetUserId: string, adminUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Get current warning count, then increment
    const { data: current } = await supabase
      .from('users')
      .select('warning_count')
      .eq('id', targetUserId)
      .single();

    const newCount =
      ((current as { warning_count: number } | null)?.warning_count ?? 0) + 1;

    const { error } = await supabase
      .from('users')
      .update({ warning_count: newCount })
      .eq('id', targetUserId);

    if (error) {
      this.logger.error(
        `Failed to warn user ${targetUserId}: ${error.message}`,
      );
      throw new NotFoundException(`Unable to warn user ${targetUserId}`);
    }

    this.logger.log(
      `User ${targetUserId} warned by admin ${adminUserId} (count: ${newCount})`,
    );
  }

  async unbanUser(targetUserId: string, adminUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ is_banned: false })
      .eq('id', targetUserId);

    if (error) {
      this.logger.error(
        `Failed to unban user ${targetUserId}: ${error.message}`,
      );
      throw new NotFoundException(`Unable to unban user ${targetUserId}`);
    }

    this.logger.log(`User ${targetUserId} unbanned by admin ${adminUserId}`);
  }
}
