import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ADMIN_ACTION_REASON_CODES,
  AdminActionReasonCode,
} from '../admin/admin-action-reasons';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MAX_SUSPENSION_DAYS,
  MIN_SUSPENSION_MS,
  SUSPENSION_CACHE_MAX_ENTRIES,
  SUSPENSION_CACHE_TTL_MS,
} from './account-suspension.constants';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const DAY_MS = 24 * 60 * 60 * 1000;

const SUSPENSION_COLUMNS =
  'id, user_id, reason_code, report_id, issued_by, idempotency_key, created_at, expires_at, lifted_at, lifted_by, lift_reason_code';

interface SuspensionRow {
  id: string;
  user_id: string;
  reason_code: AdminActionReasonCode;
  report_id: string | null;
  issued_by: string | null;
  idempotency_key: string;
  created_at: string;
  expires_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  lift_reason_code: AdminActionReasonCode | null;
}

/** Operator-facing projection. Private operator notes are never returned. */
export interface AccountSuspensionView {
  id: string;
  userId: string;
  reasonCode: AdminActionReasonCode;
  reportId: string | null;
  issuedBy: string | null;
  createdAt: string;
  expiresAt: string;
  liftedAt: string | null;
  liftedBy: string | null;
  liftReasonCode: AdminActionReasonCode | null;
}

/** Minimal fact the authentication boundary needs. */
export interface ActiveSuspension {
  id: string;
  expiresAt: string;
}

export interface IssueSuspensionInput {
  actorUserId: string;
  targetUserId: string;
  reasonCode: AdminActionReasonCode;
  operatorNote?: string;
  expiresAt: Date;
  idempotencyKey: string;
  reportId?: string;
}

export interface LiftSuspensionInput {
  actorUserId: string;
  suspensionId: string;
  reasonCode: AdminActionReasonCode;
  operatorNote?: string;
}

export interface SuspensionOutcome {
  suspension: AccountSuspensionView;
  /** True when this call matched an earlier identical request instead of changing state. */
  replayed: boolean;
}

interface CacheEntry {
  value: ActiveSuspension | null;
  fetchedAt: number;
}

const REASON_CODES = new Set<string>(ADMIN_ACTION_REASON_CODES);

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSuspensionRow(value: unknown): value is SuspensionRow {
  if (typeof value !== 'object' || value === null) return false;
  const row: Record<string, unknown> = { ...value };
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.reason_code === 'string' &&
    REASON_CODES.has(row.reason_code) &&
    isNullableString(row.report_id) &&
    isNullableString(row.issued_by) &&
    typeof row.idempotency_key === 'string' &&
    typeof row.created_at === 'string' &&
    typeof row.expires_at === 'string' &&
    isNullableString(row.lifted_at) &&
    isNullableString(row.lifted_by) &&
    (row.lift_reason_code === null ||
      (typeof row.lift_reason_code === 'string' &&
        REASON_CODES.has(row.lift_reason_code)))
  );
}

function toView(row: SuspensionRow): AccountSuspensionView {
  return {
    id: row.id,
    userId: row.user_id,
    reasonCode: row.reason_code,
    reportId: row.report_id,
    issuedBy: row.issued_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    liftedAt: row.lifted_at,
    liftedBy: row.lifted_by,
    liftReasonCode: row.lift_reason_code,
  };
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Time-bounded, reversible account suspensions.
 *
 * Writes are idempotent (per issuing operator and key) and history is
 * append-only in the database. Reads at the authentication boundary use a small
 * bounded per-instance cache; the issuing instance invalidates it immediately, so
 * other instances observe a change within `SUSPENSION_CACHE_TTL_MS`.
 */
@Injectable()
export class AccountSuspensionService {
  private readonly logger = new Logger(AccountSuspensionService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<ActiveSuspension | null>
  >();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Returns the suspension currently blocking the user, or null. A lookup
   * failure fails open: the identity check already succeeded and a degraded
   * database must not turn into a platform-wide outage. The failure is counted.
   */
  async findActive(userId: string): Promise<ActiveSuspension | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && now - cached.fetchedAt < SUSPENSION_CACHE_TTL_MS) {
      return this.stillActive(cached.value, now);
    }

    const pending = this.inFlight.get(userId);
    if (pending) return pending;

    const lookup = this.loadActive(userId).finally(() => {
      this.inFlight.delete(userId);
    });
    this.inFlight.set(userId, lookup);
    return lookup;
  }

  async issue(input: IssueSuspensionInput): Promise<SuspensionOutcome> {
    this.assertExpiryWithinBounds(input.expiresAt);

    const replay = await this.findByIdempotencyKey(
      input.actorUserId,
      input.idempotencyKey,
    );
    if (replay) return this.replayIssue(replay, input);

    const client = this.supabaseService.getClient();
    const { data: target, error: targetError } = await client
      .from('users')
      .select('id')
      .eq('id', input.targetUserId)
      .maybeSingle();
    if (targetError) {
      this.failed('issue', 'account_suspension_target_lookup_failed');
    }
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const { data, error } = await client
      .from('account_suspensions')
      .insert({
        user_id: input.targetUserId,
        reason_code: input.reasonCode,
        operator_note: input.operatorNote ?? null,
        report_id: input.reportId ?? null,
        issued_by: input.actorUserId,
        idempotency_key: input.idempotencyKey,
        expires_at: input.expiresAt.toISOString(),
      })
      .select(SUSPENSION_COLUMNS)
      .single();

    if (error) {
      const code = errorCode(error);
      if (code === POSTGRES_UNIQUE_VIOLATION) {
        // A concurrent identical request won the unique key; resolve to it.
        const raced = await this.findByIdempotencyKey(
          input.actorUserId,
          input.idempotencyKey,
        );
        if (raced) return this.replayIssue(raced, input);
      }
      if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
        this.metrics.recordAccountSuspensionAction('issue', 'failure');
        throw new BadRequestException('Referenced report does not exist');
      }
      this.failed('issue', 'account_suspension_insert_failed');
    }
    if (!isSuspensionRow(data)) {
      this.failed('issue', 'account_suspension_insert_malformed');
    }

    this.cache.delete(input.targetUserId);
    this.metrics.recordAccountSuspensionAction('issue', 'success');
    this.logger.log({
      event: 'account_suspension_issued',
      suspensionId: data.id,
    });
    return { suspension: toView(data), replayed: false };
  }

  async lift(input: LiftSuspensionInput): Promise<SuspensionOutcome> {
    const existing = await this.findById(input.suspensionId);
    if (!existing) {
      throw new NotFoundException('Suspension not found');
    }
    if (existing.lifted_at !== null) {
      this.metrics.recordAccountSuspensionAction('lift', 'replayed');
      return { suspension: toView(existing), replayed: true };
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('account_suspensions')
      .update({
        lifted_at: new Date().toISOString(),
        lifted_by: input.actorUserId,
        lift_reason_code: input.reasonCode,
        lift_operator_note: input.operatorNote ?? null,
      })
      .eq('id', input.suspensionId)
      .is('lifted_at', null)
      .select(SUSPENSION_COLUMNS)
      .maybeSingle();

    if (error) {
      this.failed('lift', 'account_suspension_lift_failed');
    }
    if (data === null) {
      // Lifted concurrently between the read and the conditional update.
      const settled = await this.findById(input.suspensionId);
      if (!settled) throw new NotFoundException('Suspension not found');
      this.metrics.recordAccountSuspensionAction('lift', 'replayed');
      return { suspension: toView(settled), replayed: true };
    }
    if (!isSuspensionRow(data)) {
      this.failed('lift', 'account_suspension_lift_malformed');
    }

    this.cache.delete(existing.user_id);
    this.metrics.recordAccountSuspensionAction('lift', 'success');
    this.logger.log({
      event: 'account_suspension_lifted',
      suspensionId: data.id,
    });
    return { suspension: toView(data), replayed: false };
  }

  /**
   * Batched lookup for the moderation queue: the active suspension of each
   * listed user in one query, bounded by the caller's page size.
   */
  async findActiveForUsers(
    userIds: readonly string[],
  ): Promise<Map<string, ActiveSuspension>> {
    const result = new Map<string, ActiveSuspension>();
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return result;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('account_suspensions')
      .select('id, user_id, expires_at')
      .in('user_id', unique)
      .is('lifted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false });
    if (error) {
      this.failed('issue', 'account_suspension_batch_lookup_failed');
    }

    for (const row of Array.isArray(data) ? data : []) {
      if (
        typeof row === 'object' &&
        row !== null &&
        typeof row.id === 'string' &&
        typeof row.user_id === 'string' &&
        typeof row.expires_at === 'string' &&
        !result.has(row.user_id)
      ) {
        result.set(row.user_id, { id: row.id, expiresAt: row.expires_at });
      }
    }
    return result;
  }

  private async loadActive(userId: string): Promise<ActiveSuspension | null> {
    const now = Date.now();
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('account_suspensions')
        .select('id, expires_at')
        .eq('user_id', userId)
        .is('lifted_at', null)
        .gt('expires_at', new Date(now).toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      const value =
        data &&
        typeof data.id === 'string' &&
        typeof data.expires_at === 'string'
          ? { id: data.id, expiresAt: data.expires_at }
          : null;
      this.remember(userId, { value, fetchedAt: now });
      return this.stillActive(value, now);
    } catch {
      this.metrics.recordAccountSuspensionCheckFailure();
      this.logger.warn({ event: 'account_suspension_lookup_failed' });
      return null;
    }
  }

  private stillActive(
    value: ActiveSuspension | null,
    now: number,
  ): ActiveSuspension | null {
    return value && Date.parse(value.expiresAt) > now ? value : null;
  }

  private remember(userId: string, entry: CacheEntry): void {
    // Re-insert so Map iteration order approximates least-recently-fetched.
    this.cache.delete(userId);
    this.cache.set(userId, entry);
    while (this.cache.size > SUSPENSION_CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  private assertExpiryWithinBounds(expiresAt: Date): void {
    const remaining = expiresAt.getTime() - Date.now();
    if (Number.isNaN(remaining) || remaining < MIN_SUSPENSION_MS) {
      throw new BadRequestException(
        'Suspension must end at least one minute in the future',
      );
    }
    if (remaining > MAX_SUSPENSION_DAYS * DAY_MS) {
      throw new BadRequestException(
        `Suspension cannot exceed ${MAX_SUSPENSION_DAYS} days`,
      );
    }
  }

  private replayIssue(
    existing: SuspensionRow,
    input: IssueSuspensionInput,
  ): SuspensionOutcome {
    if (existing.user_id !== input.targetUserId) {
      this.metrics.recordAccountSuspensionAction('issue', 'conflict');
      throw new ConflictException(
        'Idempotency key was already used for a different request',
      );
    }
    this.metrics.recordAccountSuspensionAction('issue', 'replayed');
    return { suspension: toView(existing), replayed: true };
  }

  private async findByIdempotencyKey(
    actorUserId: string,
    idempotencyKey: string,
  ): Promise<SuspensionRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('account_suspensions')
      .select(SUSPENSION_COLUMNS)
      .eq('issued_by', actorUserId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (error) {
      this.failed('issue', 'account_suspension_replay_lookup_failed');
    }
    return isSuspensionRow(data) ? data : null;
  }

  private async findById(id: string): Promise<SuspensionRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('account_suspensions')
      .select(SUSPENSION_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      this.failed('lift', 'account_suspension_lookup_failed');
    }
    return isSuspensionRow(data) ? data : null;
  }

  private failed(action: 'issue' | 'lift', event: string): never {
    this.metrics.recordAccountSuspensionAction(action, 'failure');
    this.logger.error({ event });
    throw new ServiceUnavailableException(
      'Account suspension storage is unavailable',
    );
  }
}
