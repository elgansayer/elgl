import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AccountSuspensionService,
  ActiveSuspension,
  SuspensionOutcome,
} from '../account-suspension/account-suspension.service';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import {
  AdminFlaggedMomentsQueryDto,
  FlaggedMomentDecision,
  FlaggedMomentStatus,
  IssueAccountSuspensionDto,
} from './dto/admin-moderation-actions.dto';

const REPORT_COLUMNS =
  'id, reporter_id, reported_user_id, reported_moment_id, reported_moment_excerpt, reason_category, description, status, created_at, reported:reported_user_id ( display_name ), reporter:reporter_id ( display_name )';
const MAX_MEDIA_URLS = 4;
export const ADMIN_TARGET_PROTECTED_CODE = 'ADMIN_TARGET_PROTECTED';

export interface AdminFlaggedMomentEntry {
  reportId: string;
  status: string;
  reasonCategory: string;
  reportDescription: string | null;
  createdAt: string;
  reporter: { id: string | null; displayName: string | null };
  author: {
    id: string;
    displayName: string | null;
    activeSuspension: ActiveSuspension | null;
  };
  moment: {
    id: string;
    /** Text captured when the Moment was flagged, so deletion cannot erase the evidence. */
    excerpt: string | null;
    /** False once the author has deleted the Moment. */
    available: boolean;
    postType: string | null;
    targetLanguage: string | null;
    mediaType: string | null;
    mediaUrls: string[];
  };
}

export interface AdminFlaggedMomentsListResult {
  items: AdminFlaggedMomentEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResolveFlaggedMomentResult {
  reportId: string;
  status: FlaggedMomentStatus;
  /** True when the report was already in the requested state. */
  replayed: boolean;
}

interface MomentMediaRow {
  id: string;
  post_type: string | null;
  target_language: string | null;
  media_type: string | null;
  media_urls: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? { ...value } : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function displayName(embed: unknown): string | null {
  const record = asRecord(embed);
  return record ? stringOrNull(record.display_name) : null;
}

function httpsUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string' || candidate.length > 2048) continue;
    try {
      if (new URL(candidate).protocol === 'https:') urls.push(candidate);
    } catch {
      // A malformed stored URL is simply not offered to the reviewer.
    }
    if (urls.length === MAX_MEDIA_URLS) break;
  }
  return urls;
}

function toMomentMedia(value: unknown): MomentMediaRow | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== 'string') return null;
  return {
    id: row.id,
    post_type: stringOrNull(row.post_type),
    target_language: stringOrNull(row.target_language),
    media_type: stringOrNull(row.media_type),
    media_urls: httpsUrls(row.media_urls),
  };
}

/**
 * Review queue and enforcement for Moments that members have flagged.
 *
 * Statuses reuse the existing report vocabulary: `pending`, `approved`
 * (dismissed, content acceptable) and `rejected` (violation upheld).
 */
@Injectable()
export class AdminFlaggedMomentsService {
  private readonly logger = new Logger(AdminFlaggedMomentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly suspensions: AccountSuspensionService,
    private readonly authorization: AdminAuthorizationService,
    private readonly metrics: MetricsService,
  ) {}

  async list(
    query: AdminFlaggedMomentsQueryDto,
  ): Promise<AdminFlaggedMomentsListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const client = this.supabaseService.getClient();

    const { data, error, count } = await client
      .from('reports')
      .select(REPORT_COLUMNS, { count: 'exact' })
      .not('reported_moment_id', 'is', null)
      .eq('status', query.status ?? 'pending')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      this.logger.error({ event: 'flagged_moments_list_failed' });
      throw new ServiceUnavailableException('Moderation queue is unavailable');
    }

    const reports = (Array.isArray(data) ? data : [])
      .map(asRecord)
      .filter(
        (row): row is Record<string, unknown> =>
          row !== null &&
          typeof row.id === 'string' &&
          typeof row.reported_user_id === 'string' &&
          typeof row.reported_moment_id === 'string',
      );

    const momentIds = [
      ...new Set(reports.map((row) => String(row.reported_moment_id))),
    ];
    const authorIds = reports.map((row) => String(row.reported_user_id));
    const [media, active] = await Promise.all([
      this.loadMomentMedia(momentIds),
      this.suspensions.findActiveForUsers(authorIds),
    ]);

    const items = reports.map((row): AdminFlaggedMomentEntry => {
      const momentId = String(row.reported_moment_id);
      const authorId = String(row.reported_user_id);
      const live = media.get(momentId);
      return {
        reportId: String(row.id),
        status: stringOrNull(row.status) ?? 'pending',
        reasonCategory: stringOrNull(row.reason_category) ?? 'other',
        reportDescription: stringOrNull(row.description),
        createdAt: stringOrNull(row.created_at) ?? '',
        reporter: {
          id: stringOrNull(row.reporter_id),
          displayName: displayName(row.reporter),
        },
        author: {
          id: authorId,
          displayName: displayName(row.reported),
          activeSuspension: active.get(authorId) ?? null,
        },
        moment: {
          id: momentId,
          excerpt: stringOrNull(row.reported_moment_excerpt),
          available: live !== undefined,
          postType: live?.post_type ?? null,
          targetLanguage: live?.target_language ?? null,
          mediaType: live?.media_type ?? null,
          mediaUrls: live?.media_urls ?? [],
        },
      };
    });

    return { items, total: count ?? 0, page, pageSize };
  }

  /**
   * Records the reviewer's decision on one flagged-Moment report. The update is
   * conditional on `pending`, so two reviewers cannot both change a decided case.
   */
  async resolve(
    reportId: string,
    decision: FlaggedMomentDecision,
  ): Promise<ResolveFlaggedMomentResult> {
    const target: FlaggedMomentStatus =
      decision === 'dismiss' ? 'approved' : 'rejected';
    const action = decision === 'dismiss' ? 'approve' : 'reject';
    const current = await this.readMomentReport(reportId);

    if (current.status === target) {
      return { reportId, status: target, replayed: true };
    }
    if (current.status !== 'pending') {
      throw new ConflictException(
        `This report was already resolved as ${current.status}`,
      );
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('reports')
      .update({ status: target })
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (error) {
      this.metrics.recordAdminReportResolution(action, 'failure');
      this.logger.error({ event: 'flagged_moment_resolve_failed' });
      throw new ServiceUnavailableException('Moderation queue is unavailable');
    }
    if (!data) {
      // Another reviewer decided between our read and the conditional update.
      const settled = await this.readMomentReport(reportId);
      if (settled.status === target) {
        return { reportId, status: target, replayed: true };
      }
      throw new ConflictException(
        `This report was already resolved as ${settled.status}`,
      );
    }

    this.metrics.recordAdminReportResolution(action, 'success');
    return { reportId, status: target, replayed: false };
  }

  /**
   * Suspends the author of a flagged Moment. Administrators and the operator
   * themselves are refused so a mistaken click cannot lock out the people who
   * can undo it. When a report justifies the action it is upheld afterwards;
   * the suspension is the source of truth, and a retry converges the report.
   */
  async suspendUser(
    actorUserId: string,
    targetUserId: string,
    dto: IssueAccountSuspensionDto,
  ): Promise<SuspensionOutcome & { reportStatus: FlaggedMomentStatus | null }> {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot suspend your own account');
    }
    const capabilities =
      await this.authorization.getEffectiveCapabilities(targetUserId);
    if (capabilities.length > 0) {
      // A stable code lets the portal tell this apart from a missing capability.
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: ADMIN_TARGET_PROTECTED_CODE,
        message: 'Administrators cannot be suspended from the moderation queue',
      });
    }

    if (dto.reportId) {
      const report = await this.readMomentReport(dto.reportId);
      if (report.reportedUserId !== targetUserId) {
        throw new BadRequestException(
          'The report does not concern the user being suspended',
        );
      }
    }

    const outcome = await this.suspensions.issue({
      actorUserId,
      targetUserId,
      reasonCode: dto.reasonCode,
      operatorNote: dto.operatorNote,
      expiresAt: new Date(dto.expiresAt),
      idempotencyKey: dto.idempotencyKey,
      reportId: dto.reportId,
    });

    let reportStatus: FlaggedMomentStatus | null = null;
    if (dto.reportId) {
      try {
        reportStatus = (await this.resolve(dto.reportId, 'uphold')).status;
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          this.logger.warn({ event: 'suspension_report_uphold_failed' });
        }
        // The suspension stands; the reviewer sees the report still open or
        // already decided differently and can act on it deliberately.
      }
    }
    return { ...outcome, reportStatus };
  }

  private async readMomentReport(reportId: string): Promise<{
    status: string;
    reportedUserId: string;
  }> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('reports')
      .select('id, status, reported_user_id, reported_moment_id')
      .eq('id', reportId)
      .maybeSingle();
    if (error) {
      this.logger.error({ event: 'flagged_moment_lookup_failed' });
      throw new ServiceUnavailableException('Moderation queue is unavailable');
    }

    const row = asRecord(data);
    if (!row) {
      throw new NotFoundException('Report not found');
    }
    if (
      row.reported_moment_id === null ||
      row.reported_moment_id === undefined
    ) {
      throw new BadRequestException('This report is not about a Moment');
    }
    return {
      status: stringOrNull(row.status) ?? 'pending',
      reportedUserId: stringOrNull(row.reported_user_id) ?? '',
    };
  }

  private async loadMomentMedia(
    momentIds: string[],
  ): Promise<Map<string, MomentMediaRow>> {
    const result = new Map<string, MomentMediaRow>();
    if (momentIds.length === 0) return result;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('moments')
      .select('id, post_type, target_language, media_type, media_urls')
      .in('id', momentIds);
    if (error) {
      // Media is supplementary evidence; the snapshot still lets the review proceed.
      this.logger.warn({ event: 'flagged_moment_media_lookup_failed' });
      return result;
    }

    for (const row of Array.isArray(data) ? data : []) {
      const media = toMomentMedia(row);
      if (media) result.set(media.id, media);
    }
    return result;
  }
}
