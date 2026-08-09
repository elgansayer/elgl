import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { SupabaseService, type UsersRow } from '../supabase/supabase.service';
import { DataScrubbingService } from '../privacy/data-scrubbing.service';
import { MetricsService } from '../metrics/metrics.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ToggleVipDto } from './dto/toggle-vip.dto';
import {
  AdminUserListResult,
  AdminUserSummary,
  AdminBlockEntry,
  AdminBlocksListResult,
  AdminReportEntry,
  AdminReportsListResult,
  LoginHistoryEntry,
} from './interfaces/admin-user.interface';

const SUMMARY_COLUMNS =
  'id, display_name, avatar_url, native_languages, target_languages, is_vip, vip_tier, is_admin, coins_balance, study_streak_days, last_active_at, created_at';

const CACHE_TTL_USERS = 300;
const CACHE_TTL_BLOCKS = 300;
const CACHE_TTL_REPORTS = 300;
const CACHE_TTL_LOGIN_HISTORY = 600;

const CACHE_PREFIX_USERS = 'admin:users:list:';
const CACHE_PREFIX_BLOCKS = 'admin:blocks:list:';
const CACHE_PREFIX_REPORTS = 'admin:reports:list:';
const CACHE_PREFIX_LOGIN_HISTORY = 'admin:login-history:';

@Injectable()
export class AdminService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly scrubbingService: DataScrubbingService,
    private readonly metrics: MetricsService,
    @InjectPinoLogger(AdminService.name)
    private readonly logger: PinoLogger,
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
        this.logger.info(
          `Invalidated ${keys.length} admin user list cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(err, 'Failed to invalidate admin user list caches');
    }
  }

  private async invalidateBlocksListCaches(): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys(`${CACHE_PREFIX_BLOCKS}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.info(
          `Invalidated ${keys.length} admin blocks list cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(err, 'Failed to invalidate admin blocks list caches');
    }
  }

  private async invalidateReportsListCaches(): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys(`${CACHE_PREFIX_REPORTS}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.info(
          `Invalidated ${keys.length} admin reports list cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(err, 'Failed to invalidate admin reports list caches');
    }
  }

  private async invalidateLoginHistoryCache(userId: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const key = `${CACHE_PREFIX_LOGIN_HISTORY}${userId}`;
      await redis.del(key);
    } catch (err) {
      this.logger.error(
        err,
        `Failed to invalidate login history cache for user ${userId}`,
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
      this.logger.warn(err, 'Failed to read admin user list from cache');
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
      this.logger.warn(error, `Failed to list admin users`);
      return { users: [], total: 0, page, pageSize };
    }

    const result: AdminUserListResult = {
      users: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    };

    try {
      const redis = this.getRedis();
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_USERS);
    } catch (err) {
      this.logger.warn(err, 'Failed to cache admin user list');
    }

    return result;
  }

  async setVipStatus(
    userId: string,
    dto: ToggleVipDto,
  ): Promise<AdminUserSummary> {
    const start = Date.now();
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
      this.metrics.recordAdminVipToggle('failure');
      this.metrics.recordAdminApiError('users', 'database_error');
      throw new NotFoundException(
        `Unable to update VIP status for user ${userId}`,
      );
    }

    this.metrics.recordAdminVipToggle('success');
    this.metrics.observeAdminApiLatency(
      'users',
      'setVipStatus',
      (Date.now() - start) / 1000,
    );

    await this.invalidateUserListCaches();
    await this.invalidateLoginHistoryCache(userId);

    return data;
  }

  async getLoginHistory(userId: string): Promise<LoginHistoryEntry[]> {
    const cacheKey = `${CACHE_PREFIX_LOGIN_HISTORY}${userId}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          this.metrics.recordAdminLoginHistoryRequest('success');
          return parsed as LoginHistoryEntry[];
        }
      }
    } catch (err) {
      this.logger.warn(
        err,
        `Failed to read login history cache for user ${userId}`,
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
      this.metrics.recordAdminLoginHistoryRequest('failure');
      this.logger.warn(
        error,
        `Failed to fetch login history for user ${userId}`,
      );
      return [];
    }

    this.metrics.recordAdminLoginHistoryRequest('success');
    const result = data ?? [];

    // GDPR: scrub IP addresses before returning to the admin dashboard
    this.scrubbingService.scrubLoginHistory(result);

    try {
      const redis = this.getRedis();
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_LOGIN_HISTORY,
      );
    } catch (err) {
      this.logger.warn(err, `Failed to cache login history for user ${userId}`);
    }

    return result;
  }

  async banUser(targetUserId: string, adminUserId: string): Promise<void> {
    const start = Date.now();
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('blocks').insert({
      blocker_id: adminUserId,
      blocked_id: targetUserId,
    });
    if (error) {
      this.metrics.recordAdminBanAction('failure');
      this.metrics.recordAdminApiError('ban', 'database_error');
      this.logger.error(error, `Failed to ban user ${targetUserId}`);
      throw new NotFoundException(`Unable to ban user ${targetUserId}`);
    }

    this.metrics.recordAdminBanAction('success');
    this.metrics.observeAdminApiLatency(
      'ban',
      'banUser',
      (Date.now() - start) / 1000,
    );

    await this.invalidateUserListCaches();
    await this.invalidateBlocksListCaches();
    await this.invalidateLoginHistoryCache(targetUserId);
  }

  async warnUser(targetUserId: string, adminUserId: string): Promise<void> {
    const start = Date.now();
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('reports').insert({
      reporter_id: adminUserId,
      reported_user_id: targetUserId,
      reason_category: 'admin_warning',
      description: 'Admin warning',
      status: 'open',
    });
    if (error) {
      this.metrics.recordAdminWarnAction('failure');
      this.metrics.recordAdminApiError('warn', 'database_error');
      this.logger.error(error, `Failed to warn user ${targetUserId}`);
      throw new NotFoundException(`Unable to warn user ${targetUserId}`);
    }

    this.metrics.recordAdminWarnAction('success');
    this.metrics.observeAdminApiLatency(
      'warn',
      'warnUser',
      (Date.now() - start) / 1000,
    );

    await this.invalidateUserListCaches();
    await this.invalidateReportsListCaches();
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
      this.logger.warn(err, 'Failed to read admin blocks list from cache');
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
      this.logger.warn(error, 'Failed to list blocks');
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
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_BLOCKS);
    } catch (err) {
      this.logger.warn(err, 'Failed to cache admin blocks list');
    }

    return result;
  }

  async listReports(
    page = 1,
    pageSize = 20,
    statusFilter?: string,
  ): Promise<AdminReportsListResult> {
    const status = statusFilter ?? '';
    const cacheKey = `${CACHE_PREFIX_REPORTS}${page}:${pageSize}:${status}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'reports' in parsed &&
          'total' in parsed
        ) {
          return parsed as AdminReportsListResult;
        }
      }
    } catch (err) {
      this.logger.warn(err, 'Failed to read admin reports list from cache');
    }

    const supabase = this.supabaseService.getClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = supabase
      .from('reports')
      .select(
        'id, reporter_id, reported_user_id, reason_category, description, status, created_at, reported:reported_user_id ( display_name ), reporter:reporter_id ( display_name )',
        { count: 'exact' },
      );

    if (statusFilter) {
      request = request.eq('status', statusFilter);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(error, 'Failed to list reports');
      return { reports: [], total: 0, page, pageSize };
    }

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

    const result: AdminReportsListResult = {
      reports,
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
        CACHE_TTL_REPORTS,
      );
    } catch (err) {
      this.logger.warn(err, 'Failed to cache admin reports list');
    }

    return result;
  }

  async removeBlock(blockId: string): Promise<{ success: boolean }> {
    const start = Date.now();
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('blocks').delete().eq('id', blockId);

    if (error) {
      this.metrics.recordAdminBlockRemoval('failure');
      this.metrics.recordAdminApiError('blocks', 'database_error');
      this.logger.error(error, `Failed to remove block ${blockId}`);
      throw new NotFoundException(`Unable to remove block ${blockId}`);
    }

    this.metrics.recordAdminBlockRemoval('success');
    this.metrics.observeAdminApiLatency(
      'blocks',
      'removeBlock',
      (Date.now() - start) / 1000,
    );

    await this.invalidateBlocksListCaches();

    return { success: true };
  }
}
