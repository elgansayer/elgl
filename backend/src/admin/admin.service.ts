import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService, type UsersRow } from '../supabase/supabase.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  AdminBlockEntry,
  AdminBlocksListResult,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';

const SUMMARY_COLUMNS =
  'id, display_name, avatar_url, native_languages, target_languages, is_vip, vip_tier, is_admin, coins_balance, study_streak_days, last_active_at, created_at';

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
    const { error } = await supabase.from('blocks').insert({
      blocker_id: adminUserId,
      blocked_id: targetUserId,
    });
    if (error) {
      this.logger.error(`Failed to ban user ${targetUserId}: ${error.message}`);
      throw new NotFoundException(`Unable to ban user ${targetUserId}`);
    }
  }

  async warnUser(targetUserId: string, adminUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('reports').insert({
      reporter_id: adminUserId,
      reported_user_id: targetUserId,
      reason_category: 'admin_warning',
      description: 'Admin warning',
      status: 'open',
    });
    if (error) {
      this.logger.error(
        `Failed to warn user ${targetUserId}: ${error.message}`,
      );
      throw new NotFoundException(`Unable to warn user ${targetUserId}`);
    }
  }

  async listAllBlocks(page = 1, pageSize = 20): Promise<AdminBlocksListResult> {
    const supabase = this.supabaseService.getClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('blocks')
      .select(
        'id, blocker_id, blocked_id, created_at, blocker:blocker_id ( display_name, avatar_url ), blocked:blocked_id ( display_name, avatar_url )',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(`Failed to list blocks: ${error.message}`);
      return { blocks: [], total: 0, page, pageSize };
    }

    const blocks: AdminBlockEntry[] = (data ?? []).map((row: Record<string, unknown>) => {
      const blocker = row.blocker as { display_name?: string; avatar_url?: string } | null;
      const blocked = row.blocked as { display_name?: string; avatar_url?: string } | null;
      return {
        id: row.id as string,
        blocker_id: row.blocker_id as string,
        blocked_id: row.blocked_id as string,
        blocker_name: blocker?.display_name ?? null,
        blocked_name: blocked?.display_name ?? null,
        blocker_avatar: blocker?.avatar_url ?? null,
        blocked_avatar: blocked?.avatar_url ?? null,
        created_at: row.created_at as string,
      };
    });

    return { blocks, total: count ?? 0, page, pageSize };
  }

  async removeBlock(blockId: string): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('id', blockId);

    if (error) {
      this.logger.error(`Failed to remove block ${blockId}: ${error.message}`);
      throw new NotFoundException(`Unable to remove block ${blockId}`);
    }

    return { success: true };
  }
}
