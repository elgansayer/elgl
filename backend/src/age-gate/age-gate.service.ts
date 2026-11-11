import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { AgeGateEventRow, SupabaseService } from '../supabase/supabase.service';
import {
  AGE_GATE_BAN_DURATION,
  AGE_GATE_ERROR_CODES,
  AGE_GATE_EVENT_RETENTION_MONTHS,
  AGE_GATE_LOCKOUT_HOURS,
  AGE_GATE_SWEEP_BATCH_SIZE,
  AgeGateStatus,
  COPPA_MINIMUM_AGE,
} from './age-gate.constants';
import { assessDateOfBirth, hashLockoutIdentifier } from './age-gate-policy';
import { AgeGateStatusService } from './age-gate-status.service';
import { SubmitAgeGateDto } from './dto/submit-age-gate.dto';

export interface AgeGateSubject {
  id: string;
  email?: string | null;
}

/** What the client may learn: never the threshold or the stored date. */
export interface AgeGateStatusView {
  status: AgeGateStatus;
  required: boolean;
  blocked: boolean;
}

type AgeGateOutcome = AgeGateEventRow['outcome'];

const MAX_SWEEP_PAGES = 20;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AgeGateService {
  private readonly logger = new Logger(AgeGateService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly statusService: AgeGateStatusService,
    private readonly configService: ConfigService,
    @Optional() private readonly safetyCache?: SafetyCacheInvalidationService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async getStatus(
    userId: string,
    now: Date = new Date(),
  ): Promise<AgeGateStatusView> {
    return this.toView(await this.statusService.getStatus(userId), now);
  }

  /**
   * Records the account's declared date of birth. The first declaration wins:
   * a later call can neither change a passed account nor reopen a blocked one,
   * so retries are idempotent and re-entering a different date does nothing.
   */
  async submitDateOfBirth(
    subject: AgeGateSubject,
    dto: SubmitAgeGateDto,
    now: Date = new Date(),
  ): Promise<AgeGateStatusView> {
    const assessment = assessDateOfBirth(dto.dateOfBirth, now);
    if (
      assessment.kind === 'invalid' ||
      assessment.kind === 'future' ||
      assessment.kind === 'implausible'
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: AGE_GATE_ERROR_CODES.invalidDateOfBirth,
        message: 'Enter a valid date of birth',
      });
    }

    const current = await this.statusService.getStatus(subject.id);
    if (current === 'passed' || current === 'blocked_under_age') {
      return this.toView(current, now);
    }

    const lockedOut = await this.isLockedOut(subject.email, now);
    if (assessment.kind === 'under_age' || lockedOut) {
      return this.blockUnderAge(
        subject,
        assessment.kind === 'under_age'
          ? 'blocked_under_age'
          : 'lockout_blocked',
        now,
      );
    }

    return this.markPassed(subject, dto.dateOfBirth, assessment.age, now);
  }

  /**
   * Hourly housekeeping, safe to run on every replica because each step is an
   * idempotent compare-and-set or delete:
   *  1. schedule immediate erasure for blocked accounts that still lack it,
   *  2. remove the sign-in identity once the account data has been erased,
   *  3. purge expired lockouts and aged outcome-log rows.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'ageGateMaintenance' })
  async runMaintenance(now: Date = new Date()): Promise<void> {
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['schedule_erasure', () => this.scheduleErasureForBlockedAccounts(now)],
      ['purge_identities', () => this.purgeErasedIdentities()],
      ['purge_expired', () => this.purgeExpiredRecords(now)],
    ];

    for (const [name, step] of steps) {
      try {
        await step();
      } catch {
        // One failing step must not starve the others; the next run retries.
        this.logger.error(`age_gate_maintenance_step_failed step=${name}`);
      }
    }
  }

  async scheduleErasureForBlockedAccounts(
    now: Date = new Date(),
  ): Promise<number> {
    const client = this.supabaseService.getClient();
    const nowIso = now.toISOString();
    let scheduled = 0;
    let cursor = ZERO_UUID;

    for (let page = 0; page < MAX_SWEEP_PAGES; page += 1) {
      const { data, error } = await client
        .from('users')
        .select('id, is_deletion_pending, scheduled_for_deletion_at')
        .eq('age_gate_status', 'blocked_under_age')
        .eq('is_deleted', false)
        .or(
          `is_deletion_pending.eq.false,scheduled_for_deletion_at.gt.${nowIso}`,
        )
        .gt('id', cursor)
        .order('id', { ascending: true })
        .limit(AGE_GATE_SWEEP_BATCH_SIZE);

      if (error) {
        this.logger.error('age_gate_erasure_query_failed');
        throw new ServiceUnavailableException('Age gate sweep unavailable');
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        cursor = row.id;
        if (
          await this.scheduleImmediateErasure(
            row.id,
            row.is_deletion_pending === true,
            nowIso,
          )
        ) {
          scheduled += 1;
          await this.recordEvent(row.id, 'erasure_scheduled');
        }
      }
      if (data.length < AGE_GATE_SWEEP_BATCH_SIZE) break;
    }

    if (scheduled > 0) {
      this.logger.log(`age_gate_erasure_scheduled count=${scheduled}`);
    }
    return scheduled;
  }

  async purgeErasedIdentities(): Promise<number> {
    const client = this.supabaseService.getClient();
    let purged = 0;
    let failed = 0;
    let cursor = ZERO_UUID;

    for (let page = 0; page < MAX_SWEEP_PAGES; page += 1) {
      const { data, error } = await client
        .from('users')
        .select('id')
        .eq('age_gate_status', 'blocked_under_age')
        .eq('is_deleted', true)
        .gt('id', cursor)
        .order('id', { ascending: true })
        .limit(AGE_GATE_SWEEP_BATCH_SIZE);

      if (error) {
        this.logger.error('age_gate_identity_query_failed');
        throw new ServiceUnavailableException('Age gate sweep unavailable');
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        cursor = row.id;
        const { error: deleteError } = await client.auth.admin.deleteUser(
          row.id,
        );
        if (deleteError) {
          failed += 1;
          continue;
        }
        purged += 1;
        await this.recordEvent(row.id, 'identity_purged');
      }
      if (data.length < AGE_GATE_SWEEP_BATCH_SIZE) break;
    }

    if (failed > 0) {
      // Counts only: neither identifiers nor provider messages are logged.
      this.logger.error(`age_gate_identity_purge_failed count=${failed}`);
    }
    if (purged > 0) {
      this.logger.log(`age_gate_identity_purged count=${purged}`);
    }
    return purged;
  }

  async purgeExpiredRecords(now: Date = new Date()): Promise<void> {
    const client = this.supabaseService.getClient();
    const retentionCutoff = new Date(now);
    retentionCutoff.setUTCMonth(
      retentionCutoff.getUTCMonth() - AGE_GATE_EVENT_RETENTION_MONTHS,
    );

    const { error: lockoutError } = await client
      .from('age_gate_lockouts')
      .delete()
      .lt('locked_until', now.toISOString());
    const { error: eventError } = await client
      .from('age_gate_events')
      .delete()
      .lt('created_at', retentionCutoff.toISOString());

    if (lockoutError || eventError) {
      this.logger.error('age_gate_retention_purge_failed');
      throw new ServiceUnavailableException('Age gate retention unavailable');
    }
  }

  private async markPassed(
    subject: AgeGateSubject,
    dateOfBirth: string,
    age: number,
    now: Date,
  ): Promise<AgeGateStatusView> {
    await this.ensureUserRow(subject.id);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({
        date_of_birth: dateOfBirth,
        age,
        age_gate_status: 'passed',
        age_gate_completed_at: now.toISOString(),
      })
      .eq('id', subject.id)
      .in('age_gate_status', ['legacy', 'required'])
      .select('id');

    if (error) {
      this.logger.error('age_gate_pass_write_failed');
      throw new ServiceUnavailableException('Unable to record age assurance');
    }

    this.statusService.invalidate(subject.id);
    if (!data || data.length === 0) {
      // A concurrent request completed the gate first; report what it decided.
      return this.toView(await this.statusService.getStatus(subject.id), now);
    }

    await this.recordEvent(subject.id, 'passed');
    this.metrics?.recordAgeGateDecision('passed');
    this.logger.log('age_gate_decision outcome=passed');
    return this.toView('passed', now);
  }

  private async blockUnderAge(
    subject: AgeGateSubject,
    outcome: Extract<AgeGateOutcome, 'blocked_under_age' | 'lockout_blocked'>,
    now: Date,
  ): Promise<AgeGateStatusView> {
    await this.ensureUserRow(subject.id);
    const nowIso = now.toISOString();
    const client = this.supabaseService.getClient();

    // One statement blocks access, drops the declared age, hides the profile
    // and requests immediate erasure. The date of birth is never persisted.
    const { data, error } = await client
      .from('users')
      .update({
        age_gate_status: 'blocked_under_age',
        age_gate_completed_at: nowIso,
        date_of_birth: null,
        age: null,
        is_deletion_pending: true,
        deletion_requested_at: nowIso,
        scheduled_for_deletion_at: nowIso,
        privacy_hide_from_search: true,
        location: null,
        mock_location: null,
        mock_country: null,
        mock_city: null,
      })
      .eq('id', subject.id)
      .in('age_gate_status', ['legacy', 'required'])
      .select('id');

    if (error) {
      this.logger.error('age_gate_block_write_failed');
      throw new ServiceUnavailableException('Unable to record age assurance');
    }

    this.statusService.invalidate(subject.id);
    if (!data || data.length === 0) {
      return this.toView(await this.statusService.getStatus(subject.id), now);
    }

    await Promise.all([
      this.recordEvent(subject.id, outcome),
      this.recordLockout(subject.email, now),
      this.banSignIn(subject.id),
      this.safetyCache?.invalidateUserCaches(subject.id),
    ]);

    this.metrics?.recordAgeGateDecision(outcome);
    this.logger.log(`age_gate_decision outcome=${outcome}`);
    return this.toView('blocked_under_age', now);
  }

  /** Inserts the profile row if sign-up has not created it yet. */
  private async ensureUserRow(userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      this.logger.error('age_gate_profile_row_failed');
      throw new ServiceUnavailableException('Unable to record age assurance');
    }
  }

  /**
   * Moves an already-blocked account's deletion to "now". An earlier user
   * request may have scheduled it 30 days out, and the database trigger keeps
   * the first deadline while a deletion is pending, so the pending flag is
   * cleared first.
   */
  private async scheduleImmediateErasure(
    userId: string,
    wasPending: boolean,
    nowIso: string,
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();

    if (wasPending) {
      const { error: clearError } = await client
        .from('users')
        .update({ is_deletion_pending: false })
        .eq('id', userId)
        .eq('age_gate_status', 'blocked_under_age');
      if (clearError) return false;
    }

    const { error } = await client
      .from('users')
      .update({
        is_deletion_pending: true,
        deletion_requested_at: nowIso,
        scheduled_for_deletion_at: nowIso,
        privacy_hide_from_search: true,
        location: null,
        mock_location: null,
        mock_country: null,
        mock_city: null,
        age: null,
      })
      .eq('id', userId)
      .eq('age_gate_status', 'blocked_under_age');

    return !error;
  }

  private async isLockedOut(
    email: string | null | undefined,
    now: Date,
  ): Promise<boolean> {
    const identifier = this.lockoutIdentifier(email);
    if (!identifier) return false;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('age_gate_lockouts')
      .select('locked_until')
      .eq('identifier_hash', identifier)
      .gt('locked_until', now.toISOString())
      .maybeSingle();

    if (error) {
      this.logger.error('age_gate_lockout_lookup_failed');
      throw new ServiceUnavailableException('Unable to verify age assurance');
    }
    return data !== null;
  }

  private async recordLockout(
    email: string | null | undefined,
    now: Date,
  ): Promise<void> {
    const identifier = this.lockoutIdentifier(email);
    if (!identifier) return;

    const lockedUntil = new Date(
      now.getTime() + AGE_GATE_LOCKOUT_HOURS * 60 * 60 * 1000,
    );
    const { error } = await this.supabaseService
      .getClient()
      .from('age_gate_lockouts')
      .upsert(
        {
          identifier_hash: identifier,
          locked_until: lockedUntil.toISOString(),
        },
        { onConflict: 'identifier_hash' },
      );
    if (error) this.logger.error('age_gate_lockout_write_failed');
  }

  private async banSignIn(userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .auth.admin.updateUserById(userId, {
          ban_duration: AGE_GATE_BAN_DURATION,
        });
      if (error) this.logger.error('age_gate_sign_in_ban_failed');
    } catch {
      // Access is already denied by the status check; the ban is defence in depth.
      this.logger.error('age_gate_sign_in_ban_failed');
    }
  }

  private async recordEvent(
    subjectId: string,
    outcome: AgeGateOutcome,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('age_gate_events')
        .insert({
          subject_id: subjectId,
          outcome,
          minimum_age: COPPA_MINIMUM_AGE,
        });
      if (error) this.logger.error('age_gate_event_write_failed');
    } catch {
      this.logger.error('age_gate_event_write_failed');
    }
  }

  private lockoutIdentifier(email: string | null | undefined): string | null {
    const secret = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!email || !secret) return null;
    return hashLockoutIdentifier(email, secret);
  }

  private toView(status: AgeGateStatus, now: Date): AgeGateStatusView {
    const decision = this.statusService.decide(status, now);
    return {
      status,
      required:
        !decision.allowed && decision.code === AGE_GATE_ERROR_CODES.required,
      blocked: status === 'blocked_under_age',
    };
  }
}
