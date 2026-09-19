import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
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

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
    private readonly cacheInvalidationService: SafetyCacheInvalidationService,
  ) {}

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

    this.metricsService.recordTsReportSubmitted(dto.reason_category);

    this.logger.log(
      `Report submitted: reporter=${reporterId}, reported=${dto.reported_id}, category=${dto.reason_category}`,
    );

    // Invalidate Redis caches affected by trust-graph mutation
    void this.cacheInvalidationService.invalidateUserCaches(dto.reported_id);
    void this.cacheInvalidationService.invalidateTrustAndSafetyCaches();

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

    this.metricsService.recordTsBlockCreated();

    this.logger.log(`User ${blockerId} blocked ${dto.blocked_id}`);

    // Invalidate Redis caches affected by trust-graph mutation
    void this.cacheInvalidationService.invalidateUserPairCaches(
      blockerId,
      dto.blocked_id,
    );
    void this.cacheInvalidationService.invalidateTrustAndSafetyCaches();

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

    this.metricsService.recordTsBlockRemoved();

    this.logger.log(`User ${blockerId} unblocked ${blockedId}`);

    // Invalidate Redis caches affected by trust-graph mutation
    void this.cacheInvalidationService.invalidateUserPairCaches(
      blockerId,
      blockedId,
    );
    void this.cacheInvalidationService.invalidateTrustAndSafetyCaches();

    return { success: true };
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
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

    return data !== null;
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error || !data) {
      this.logger.error(`Failed to get blocked user IDs for ${userId}:`, error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return (data as { blocked_id: string }[]).map((b) => b.blocked_id);
  }

  async getBlockerUserIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', userId);

    if (error || !data) {
      this.logger.error(`Failed to get blocker user IDs for ${userId}:`, error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return (data as { blocker_id: string }[]).map((b) => b.blocker_id);
  }

  async getBlockedAndBlockerIds(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const [blockedResult, blockerResult] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', userId),
    ]);

    const blockedRows = blockedResult.data;
    const blockerRows = blockerResult.data;
    const hasBlockedId = (row: unknown): row is { blocked_id: string } =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { blocked_id?: unknown }).blocked_id === 'string' &&
      (row as { blocked_id: string }).blocked_id.trim().length > 0 &&
      (row as { blocked_id: string }).blocked_id ===
        (row as { blocked_id: string }).blocked_id.trim();
    const hasBlockerId = (row: unknown): row is { blocker_id: string } =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { blocker_id?: unknown }).blocker_id === 'string' &&
      (row as { blocker_id: string }).blocker_id.trim().length > 0 &&
      (row as { blocker_id: string }).blocker_id ===
        (row as { blocker_id: string }).blocker_id.trim();

    if (
      blockedResult.error ||
      blockerResult.error ||
      !Array.isArray(blockedRows) ||
      !Array.isArray(blockerRows) ||
      !blockedRows.every(hasBlockedId) ||
      !blockerRows.every(hasBlockerId)
    ) {
      this.logger.error(`Failed to load complete block graph for ${userId}`);
      throw new Error('Failed to load complete block graph');
    }

    const blocked = blockedRows.map((row) => row.blocked_id);
    const blockers = blockerRows.map((row) => row.blocker_id);
    return [...new Set([...blocked, ...blockers])];
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
