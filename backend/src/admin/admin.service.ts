import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseService, type UsersRow } from '../supabase/supabase.service';
import { MonitoringService } from '../monitoring/monitoring.service';
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

const CACHE_TTL_USERS = 300;
const CACHE_TTL_BLOCKS = 300;
const CACHE_TTL_LOGIN_HISTORY = 600;

const CACHE_PREFIX_USERS = 'admin:users:list:';
const CACHE_PREFIX_BLOCKS = 'admin:blocks:list:';
const CACHE_PREFIX_LOGIN_HISTORY = 'admin:login-history:';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly monitoringService: MonitoringService,
  ) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  private async invalidateUserListCaches(): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys(`${CACHE_PREFIX_USERS}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} admin user list cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to invalidate admin user list caches',
        err,
      );
    }
  }

  private async invalidateBlocksListCaches(): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys(`${CACHE_PREFIX_BLOCKS}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} admin blocks list cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to invalidate admin blocks list caches',
        err,
      );
    }
  }

  private async invalidateLoginHistoryCache(userId: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX_LOGIN_HISTORY}${userId}`;
      await redis.del(key);
    } catch (err) {
      this.logger.error(
        `Failed to invalidate login history cache for user ${userId}`,
        err,
      );
    }
  }

  async listUsers(query: AdminUserQueryDto): Promise<AdminUserListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search ?? '';
    const cacheKey = `${CACHE_PREFIX_USERS}${page}:${pageSize}:${search}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'users' in parsed &&
          'total' in parsed
        ) {
          return parsed as AdminUserListResult;
        }
      }
    } catch (err) {
      this.logger.warn('Failed to read admin user list from cache', err);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = this.supabaseService.getClient();
    let request = supabase
      .from('users')
      .select(SUMMARY_COLUMNS, { count: 'exact' });

    if (search) {
      request = request.ilike('display_name', `%${search}%`);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(`Failed to list admin users: ${error.message}`);
      return { users: [], total: 0, page, pageSize };
    }

    const result: AdminUserListResult = {
      users: (data ?? []) as unknown as AdminUserSummary[],
      total: count ?? 0,
      page,
      pageSize,
    };

    try {
      const redis = this.getRedis();
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_USERS);
    } catch (err) {
      this.logger.warn('Failed to cache admin user list', err);
    }

    return result;
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

    this.monitoringService.recordAdminAction({
      actionType: 'vip_change',
      count: 1,
      timeWindowSeconds: 0,
    });

    await this.invalidateUserListCaches();
    await this.invalidateLoginHistoryCache(userId);

    return data;
  }

  async getLoginHistory(userId: string): Promise<LoginHistoryEntry[]> {
    this.monitoringService.recordLoginHistoryAccess();
    const cacheKey = `${CACHE_PREFIX_LOGIN_HISTORY}${userId}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed as LoginHistoryEntry[];
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to read login history cache for user ${userId}`,
        err,
      );
    }

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

    const result = data ?? [];

    try {
      const redis = this.getRedis();
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_LOGIN_HISTORY,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to cache login history for user ${userId}`,
        err,
      );
    }

    return result;
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

    this.monitoringService.recordAdminAction({
      actionType: 'ban',
      count: 1,
      timeWindowSeconds: 0,
    });

    await this.invalidateUserListCaches();
    await this.invalidateBlocksListCaches();
    await this.invalidateLoginHistoryCache(targetUserId);
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

    this.monitoringService.recordAdminAction({
      actionType: 'warn',
      count: 1,
      timeWindowSeconds: 0,
    });

    await this.invalidateUserListCaches();
    await this.invalidateLoginHistoryCache(targetUserId);
  }

  async listAllBlocks(page = 1, pageSize = 20): Promise<AdminBlocksListResult> {
    const cacheKey = `${CACHE_PREFIX_BLOCKS}${page}:${pageSize}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'blocks' in parsed &&
          'total' in parsed
        ) {
          return parsed as AdminBlocksListResult;
        }
      }
    } catch (err) {
      this.logger.warn('Failed to read admin blocks list from cache', err);
    }

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

    const blocks: AdminBlockEntry[] = (data ?? []).map(
      (row: Record<string, unknown>) => {
        const blocker = row.blocker as {
          display_name?: string;
          avatar_url?: string;
        } | null;
        const blocked = row.blocked as {
          display_name?: string;
          avatar_url?: string;
        } | null;
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
      },
    );

    const result: AdminBlocksListResult = {
      blocks,
      total: count ?? 0,
      page,
      pageSize,
    };

    try {
      const redis = this.getRedis();
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_BLOCKS,
      );
    } catch (err) {
      this.logger.warn('Failed to cache admin blocks list', err);
    }

    return result;
  }

  async removeBlock(blockId: string): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('blocks').delete().eq('id', blockId);

    if (error) {
      this.logger.error(`Failed to remove block ${blockId}: ${error.message}`);
      throw new NotFoundException(`Unable to remove block ${blockId}`);
    }

    await this.invalidateBlocksListCaches();

    return { success: true };
  }
}
