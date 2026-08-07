import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';
import { BlockedUserResponseDto } from './dto/blocked-user.dto';

export const SAFETY_CATEGORIES = [
  {
    value: 'harassment',
    label: 'Harassment',
    icon: '🚫',
    description: 'Unwanted advances, threats, or abusive behaviour',
  },
  {
    value: 'spam',
    label: 'Spam',
    icon: '📧',
    description: 'Unsolicited promotions, phishing, or fraudulent activity',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate Content',
    icon: '🔞',
    description: 'Sexually explicit, violent, or offensive material',
  },
  {
    value: 'fake_profile',
    label: 'Fake Profile',
    icon: '🎭',
    description: 'Impersonation or false identity',
  },
  {
    value: 'other',
    label: 'Other',
    icon: '📝',
    description: 'Something else not listed above',
  },
];

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);
  private readonly redis: Redis;
  private readonly BLOCK_CACHE_TTL = 3600; // 1 hour

  constructor(private readonly supabaseService: SupabaseService) {
    this.redis = this.supabaseService.getRedisClient();
  }

  getCategories() {
    return SAFETY_CATEGORIES;
  }

  async reportUser(
    reporterId: string,
    dto: ReportUserDto,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseService.getClient();

    // Prevent self-reporting
    if (reporterId === dto.reported_id) {
      throw new BadRequestException('Cannot report yourself');
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

    if (blockerId === dto.blocked_id) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Verify the target user exists
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.blocked_id)
      .maybeSingle();

    if (targetError || !targetUser) {
      throw new NotFoundException('User to block not found');
    }

    // Check if already blocked
    const { data: existing } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', dto.blocked_id)
      .maybeSingle();

    if (existing) {
      throw new BadRequestException('User is already blocked');
    }

    const { error } = await supabase.from('blocks').insert({
      blocker_id: blockerId,
      blocked_id: dto.blocked_id,
    });

    if (error) {
      throw new Error(`Failed to block user: ${error.message}`);
    }

    // Invalidate Redis caches for both parties
    await this.invalidateBlockCaches(blockerId, dto.blocked_id);

    this.logger.log(`User ${blockerId} blocked ${dto.blocked_id}`);
    return { success: true, blocked_id: dto.blocked_id };
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);

    if (error) {
      throw new Error(`Failed to unblock user: ${error.message}`);
    }

    // Invalidate Redis caches for both parties
    await this.invalidateBlockCaches(blockerId, blockedId);

    this.logger.log(`User ${blockerId} unblocked ${blockedId}`);
    return { success: true };
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const cacheKey = `safety:is_blocked:${blockerId}:${blockedId}`;

    // Check Redis cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return cached === '1';
      }
    } catch (err) {
      this.logger.warn(
        `Redis error reading isBlocked cache: ${(err as Error).message}`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to check block status: ${error.message}`);
      return false;
    }

    const result = data !== null;

    // Populate cache
    try {
      await this.redis.set(
        cacheKey,
        result ? '1' : '0',
        'EX',
        this.BLOCK_CACHE_TTL,
      );
    } catch (err) {
      this.logger.warn(
        `Redis error writing isBlocked cache: ${(err as Error).message}`,
      );
    }

    return result;
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const cacheKey = `safety:blocked_ids:${userId}`;

    // Check Redis cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return this.parseStringArray(cached);
      }
    } catch (err) {
      this.logger.warn(
        `Redis error reading blockedIds cache: ${(err as Error).message}`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    const result = this.extractBlockIdList(
      error,
      data,
      'blocked_id',
      `Failed to get blocked user IDs for ${userId}`,
    );

    // Populate cache
    await this.cacheBlockList(cacheKey, result);

    return result;
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    const cacheKey = `safety:blocker_ids:${userId}`;

    // Check Redis cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return this.parseStringArray(cached);
      }
    } catch (err) {
      this.logger.warn(
        `Redis error reading blockerIds cache: ${(err as Error).message}`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', userId);

    const result = this.extractBlockIdList(
      error,
      data,
      'blocker_id',
      `Failed to get blocker user IDs for ${userId}`,
    );

    // Populate cache
    await this.cacheBlockList(cacheKey, result);

    return result;
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    const cacheKey = `safety:blocked_and_blocker_ids:${userId}`;

    // Try combined cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        return this.parseStringArray(cached);
      }
    } catch (err) {
      this.logger.warn(
        `Redis error reading blockedAndBlockerIds cache: ${(err as Error).message}`,
      );
    }

    const [blocked, blockers] = await Promise.all([
      this.getBlockedUserIds(userId),
      this.getBlockerUserIds(userId),
    ]);
    const result = [...new Set([...blocked, ...blockers])];

    // Populate combined cache
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        this.BLOCK_CACHE_TTL,
      );
    } catch (err) {
      this.logger.warn(
        `Redis error writing blockedAndBlockerIds cache: ${(err as Error).message}`,
      );
    }

    return result;
  }

  /**
   * Invalidates all Redis cache entries related to a block relationship.
   * Called when a user blocks or unblocks another user.
   */
  private async invalidateBlockCaches(
    blockerId: string,
    blockedId: string,
  ): Promise<void> {
    const keysToDelete: string[] = [
      `safety:blocked_ids:${blockerId}`,
      `safety:blocked_and_blocker_ids:${blockerId}`,
      `safety:blocker_ids:${blockedId}`,
      `safety:blocked_and_blocker_ids:${blockedId}`,
      `safety:is_blocked:${blockerId}:${blockedId}`,
    ];

    try {
      await Promise.all(
        keysToDelete.map((key) =>
          this.redis.del(key).catch(() => {
            // Best-effort deletion – don't throw if Redis is unavailable
          }),
        ),
      );
      this.logger.debug(
        `Invalidated safety caches for blocker=${blockerId}, blocked=${blockedId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Redis error invalidating block caches: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Parses a JSON-encoded string array stored in Redis.
   */
  private parseStringArray(raw: string | null): string[] {
    if (!raw || raw === '[]') {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
    return [];
  }

  /**
   * Extracts block/blocker ID list from a Supabase query result, handling errors.
   */
  private extractBlockIdList(
    error: PostgrestError | null,
    data: unknown[] | null,
    column: string,
    logMessage: string,
  ): string[] {
    if (error || !data) {
      this.logger.error(logMessage, error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return (data as Record<string, string>[]).map(
      (row: Record<string, string>) => row[column],
    );
  }

  /**
   * Caches a block ID list in Redis with appropriate TTL.
   */
  private async cacheBlockList(cacheKey: string, ids: string[]): Promise<void> {
    try {
      if (ids.length > 0) {
        await this.redis.set(
          cacheKey,
          JSON.stringify(ids),
          'EX',
          this.BLOCK_CACHE_TTL,
        );
      } else {
        // Cache empty results with a shorter TTL to prevent stampedes on new users
        await this.redis.set(cacheKey, '[]', 'EX', 300);
      }
    } catch (err) {
      this.logger.warn(
        `Redis error writing cache ${cacheKey}: ${(err as Error).message}`,
      );
    }
  }

  async getBlockedUserDetails(
    userId: string,
  ): Promise<BlockedUserResponseDto[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds = await this.getBlockedUserIds(userId);
    if (blockedIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url, native_language, target_languages')
      .in('id', blockedIds);

    if (error || !data) {
      this.logger.error(
        `Failed to fetch blocked user details for ${userId}:`,
        error,
      );
      return [];
    }

    return (data as any[]).map((u) => ({
      id: u.id,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      native_language: u.native_language,
      target_language: u.target_languages?.[0],
    }));
  }
}
