import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
import { BlockUserDto, ReportUserDto } from './dto/safety.dto';
import { BlockedUserResponseDto } from './dto/blocked-user.dto';
import {
  SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY,
  SAFETY_REPORT_CATEGORY_VALUES,
  SAFETY_REPORT_QUOTA_WINDOW_MS,
  type SafetyOperation,
  type SafetyOutcome,
  type SafetyReportCategory,
} from './safety.constants';

export interface SafetyCategory {
  value: SafetyReportCategory;
  label: string;
  icon: string;
  description: string;
}

export const SAFETY_CATEGORIES: SafetyCategory[] = [
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

/** Result of filing a report. `duplicate` is true when an open report exists. */
export interface ReportSubmissionResult {
  id: string;
  duplicate: boolean;
}

/** Result of a block request. `already_blocked` marks an idempotent repeat. */
export interface BlockResult {
  success: boolean;
  blocked_id: string;
  already_blocked: boolean;
}

/** Postgres unique-violation and foreign-key-violation SQLSTATE codes. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * Postgres treats UUIDs as case-insensitive but string comparison and cache
 * keys do not. Every identifier is reduced to one canonical form before it is
 * compared, stored in a cache key or echoed back, so an upper-case copy of the
 * caller's own id cannot slip past the self-block and self-report checks.
 */
const canonicalId = (id: string): string => id.trim().toLowerCase();

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
    private readonly cacheInvalidationService: SafetyCacheInvalidationService,
  ) {}

  getCategories(): SafetyCategory[] {
    return SAFETY_CATEGORIES;
  }

  /**
   * Emits one structured line per state change or failure. Only opaque
   * identifiers, bounded vocabularies and database error codes are logged:
   * never descriptions, context links, provider messages or tokens.
   */
  private logEvent(
    level: 'log' | 'warn' | 'error',
    event: string,
    fields: LogFields = {},
  ): void {
    this.logger[level](JSON.stringify({ event, ...fields }));
  }

  /** Reduces a provider error to a short, log-safe code. */
  private errorCode(error: { code?: string | null } | null): string {
    const code = error?.code;
    return typeof code === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(code)
      ? code
      : 'unknown';
  }

  private recordOutcome(
    operation: SafetyOperation,
    outcome: SafetyOutcome,
  ): void {
    this.metricsService.recordTsSafetyOperation(operation, outcome);
  }

  /**
   * Cache invalidation is best-effort and must never fail or delay the
   * mutation that already succeeded, nor surface as an unhandled rejection.
   */
  private invalidateCachesInBackground(
    operation: SafetyOperation,
    tasks: Promise<void>[],
  ): void {
    void Promise.allSettled(tasks).then((results) => {
      if (results.some((result) => result.status === 'rejected')) {
        this.logEvent('warn', 'safety.cache_invalidation_failed', {
          operation,
        });
      }
    });
  }

  /**
   * Resolves the target account. Personal and business accounts share the
   * `users` record, so one lookup covers both. A lookup failure is reported as
   * a service error rather than being mistaken for a missing account.
   */
  private async assertTargetExists(
    targetId: string,
    operation: SafetyOperation,
    notFoundMessage: string,
  ): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();

    if (error) {
      this.recordOutcome(operation, 'failure');
      this.logEvent('error', `safety.${operation}.target_lookup_failed`, {
        code: this.errorCode(error),
      });
      throw new InternalServerErrorException(
        `Unable to ${operation === 'report' ? 'submit report' : `${operation} user`}`,
      );
    }

    if (!data) {
      this.recordOutcome(operation, 'rejected');
      throw new NotFoundException(notFoundMessage);
    }
  }

  /** Oldest open (pending) report this reporter filed for the same reason. */
  private async findOpenReportId(
    reporterId: string,
    reportedId: string,
    category: SafetyReportCategory,
  ): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_user_id', reportedId)
      .eq('reason_category', category)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.recordOutcome('report', 'failure');
      this.logEvent('error', 'safety.report.duplicate_lookup_failed', {
        code: this.errorCode(error),
      });
      throw new InternalServerErrorException('Unable to submit report');
    }

    return data?.id ?? null;
  }

  /**
   * Abuse ceiling on distinct reports per account. A failed count fails open:
   * a report is a protective action, and the insert that follows fails on its
   * own if the database is genuinely unavailable.
   */
  private async hasReachedReportQuota(reporterId: string): Promise<boolean> {
    const since = new Date(
      Date.now() - SAFETY_REPORT_QUOTA_WINDOW_MS,
    ).toISOString();
    const { count, error } = await this.supabaseService
      .getClient()
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .in('reason_category', [...SAFETY_REPORT_CATEGORY_VALUES])
      .gte('created_at', since);

    if (error) {
      this.logEvent('warn', 'safety.report.quota_check_failed', {
        code: this.errorCode(error),
      });
      return false;
    }

    return (count ?? 0) >= SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY;
  }

  /**
   * Files a report against a person or business account.
   *
   * The call is idempotent for an open report: repeating the same reporter,
   * target and reason while the first is still pending (a retry, a double tap,
   * or two racing requests) returns the existing report instead of creating a
   * second moderation item. A partial unique index enforces this for racing
   * inserts; see `20261104090000_harden_block_and_report_invariants.sql`.
   */
  async reportUser(
    rawReporterId: string,
    dto: ReportUserDto,
  ): Promise<ReportSubmissionResult> {
    const reporterId = canonicalId(rawReporterId);
    const reportedId = canonicalId(dto.reported_id);

    if (reporterId === reportedId) {
      this.recordOutcome('report', 'rejected');
      throw new BadRequestException('Cannot report yourself');
    }

    await this.assertTargetExists(
      reportedId,
      'report',
      'Reported user not found',
    );

    const existingId = await this.findOpenReportId(
      reporterId,
      reportedId,
      dto.reason_category,
    );
    if (existingId) {
      return this.completeDuplicateReport(existingId, dto.reason_category);
    }

    if (await this.hasReachedReportQuota(reporterId)) {
      this.recordOutcome('report', 'rate_limited');
      this.logEvent('warn', 'safety.report.rate_limited', {
        actorId: reporterId,
      });
      throw new HttpException(
        'Report limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedId,
        reason_category: dto.reason_category,
        description: dto.description?.trim() || null,
        context_url: dto.context_url?.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        // A racing request won the partial unique index; converge on its row.
        const winnerId = await this.findOpenReportId(
          reporterId,
          reportedId,
          dto.reason_category,
        );
        if (winnerId) {
          return this.completeDuplicateReport(winnerId, dto.reason_category);
        }
      }
      if (error.code === PG_FOREIGN_KEY_VIOLATION) {
        this.recordOutcome('report', 'rejected');
        throw new NotFoundException('Reported user not found');
      }
      this.recordOutcome('report', 'failure');
      this.logEvent('error', 'safety.report.insert_failed', {
        code: this.errorCode(error),
        category: dto.reason_category,
      });
      throw new InternalServerErrorException('Unable to submit report');
    }

    if (!data) {
      this.recordOutcome('report', 'failure');
      this.logEvent('error', 'safety.report.insert_empty', {
        category: dto.reason_category,
      });
      throw new InternalServerErrorException('Unable to submit report');
    }

    this.metricsService.recordTsReportSubmitted(dto.reason_category);
    this.recordOutcome('report', 'success');
    this.logEvent('log', 'safety.report.created', {
      reportId: data.id,
      category: dto.reason_category,
    });

    this.invalidateCachesInBackground('report', [
      this.cacheInvalidationService.invalidateUserCaches(reportedId),
      this.cacheInvalidationService.invalidateTrustAndSafetyCaches(),
    ]);

    return { id: data.id, duplicate: false };
  }

  private completeDuplicateReport(
    reportId: string,
    category: SafetyReportCategory,
  ): ReportSubmissionResult {
    this.recordOutcome('report', 'duplicate');
    this.logEvent('log', 'safety.report.duplicate', { reportId, category });
    return { id: reportId, duplicate: true };
  }

  /**
   * Blocks a person or business account. Blocking is idempotent: repeating the
   * request, including a concurrent one, succeeds and reports
   * `already_blocked`. The `(blocker_id, blocked_id)` unique constraint makes
   * the insert race-safe, and caches are refreshed on a repeat so a retry after
   * a partially failed earlier attempt converges.
   */
  async blockUser(
    rawBlockerId: string,
    dto: BlockUserDto,
  ): Promise<BlockResult> {
    const blockerId = canonicalId(rawBlockerId);
    const blockedId = canonicalId(dto.blocked_id);

    if (blockerId === blockedId) {
      this.recordOutcome('block', 'rejected');
      throw new BadRequestException('You cannot block yourself');
    }

    await this.assertTargetExists(
      blockedId,
      'block',
      'User to block not found',
    );

    const { data, error } = await this.supabaseService
      .getClient()
      .from('blocks')
      .upsert(
        { blocker_id: blockerId, blocked_id: blockedId },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      )
      .select('id');

    if (error) {
      if (error.code === PG_FOREIGN_KEY_VIOLATION) {
        this.recordOutcome('block', 'rejected');
        throw new NotFoundException('User to block not found');
      }
      this.recordOutcome('block', 'failure');
      this.logEvent('error', 'safety.block.insert_failed', {
        code: this.errorCode(error),
      });
      throw new InternalServerErrorException('Unable to block user');
    }

    // With ignoreDuplicates only a newly inserted row is returned.
    const created = Array.isArray(data) && data.length > 0;
    if (created) {
      this.metricsService.recordTsBlockCreated();
    }
    this.recordOutcome('block', created ? 'success' : 'duplicate');
    this.logEvent(
      'log',
      created ? 'safety.block.created' : 'safety.block.repeated',
    );

    this.invalidateCachesInBackground('block', [
      this.cacheInvalidationService.invalidateUserPairCaches(
        blockerId,
        blockedId,
      ),
      this.cacheInvalidationService.invalidateTrustAndSafetyCaches(),
    ]);

    return {
      success: true,
      blocked_id: blockedId,
      already_blocked: !created,
    };
  }

  /**
   * Removes the caller's block. Unblocking an account that is not blocked is a
   * successful no-op so retries are safe.
   */
  async unblockUser(
    rawBlockerId: string,
    rawBlockedId: string,
  ): Promise<{ success: boolean }> {
    const blockerId = canonicalId(rawBlockerId);
    const blockedId = canonicalId(rawBlockedId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId)
      .select('id');

    if (error) {
      this.recordOutcome('unblock', 'failure');
      this.logEvent('error', 'safety.unblock.delete_failed', {
        code: this.errorCode(error),
      });
      throw new InternalServerErrorException('Unable to unblock user');
    }

    const removed = Array.isArray(data) && data.length > 0;
    if (removed) {
      this.metricsService.recordTsBlockRemoved();
    }
    this.recordOutcome('unblock', removed ? 'success' : 'duplicate');
    this.logEvent(
      'log',
      removed ? 'safety.unblock.removed' : 'safety.unblock.repeated',
    );

    this.invalidateCachesInBackground('unblock', [
      this.cacheInvalidationService.invalidateUserPairCaches(
        blockerId,
        blockedId,
      ),
      this.cacheInvalidationService.invalidateTrustAndSafetyCaches(),
    ]);

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
