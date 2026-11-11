import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { DmcaNoticeRow, SupabaseService } from '../supabase/supabase.service';
import {
  DMCA_ACTIVE_STATUSES,
  DMCA_BATCH_SIZE,
  DMCA_COUNTER_NOTICE_WAIT_BUSINESS_DAYS,
  DMCA_MAX_NOTICES_PER_CLAIMANT_PER_DAY,
  DMCA_PAGE_SIZE_DEFAULT,
  DMCA_REPEAT_INFRINGER_REASON,
  DMCA_REPEAT_INFRINGER_THRESHOLD,
  DMCA_STRIKE_WINDOW_MONTHS,
  DMCA_VERIFICATION_TTL_HOURS,
  DmcaActorType,
  DmcaNoticeStatus,
  DmcaTargetType,
  isDmcaTargetType,
} from './dmca.constants';
import {
  DmcaEmail,
  DmcaClosureOutcome,
  claimantContentDisabledEmail,
  claimantCounterNoticeEmail,
  claimantNeedsReviewEmail,
  closureEmail,
  ownerContentDisabledEmail,
  ownerCounterNoticeEmail,
  verificationEmail,
} from './dmca-emails';
import { DmcaMediaService } from './dmca-media.service';
import {
  addBusinessDays,
  daysBefore,
  generateNoticeReference,
  generateVerificationToken,
  hashVerificationToken,
  hoursAfter,
  monthsBefore,
  normaliseClaimantEmail,
  parseMaterialReference,
} from './dmca-policy';
import { CreateCounterNoticeDto } from './dto/create-counter-notice.dto';
import { CreateDmcaNoticeDto } from './dto/create-dmca-notice.dto';

export interface DmcaTarget {
  type: DmcaTargetType;
  id: string;
  ownerId: string;
}

export interface DmcaActor {
  type: DmcaActorType;
  id?: string;
}

export interface DmcaSubmissionResult {
  references: string[];
  status: 'pending_verification';
}

export interface DmcaVerificationResult {
  notices: Array<{ reference: string; status: DmcaNoticeStatus }>;
}

/** What the content owner may see: claimant contact details are in the email only. */
export interface OwnerNoticeView {
  id: string;
  reference: string;
  status: DmcaNoticeStatus;
  targetType: DmcaTargetType | null;
  claimantName: string;
  claimantOrganisation: string | null;
  copyrightedWork: string;
  contentDisabledAt: string | null;
  counterNoticeAt: string | null;
  restoreAfter: string | null;
  closedAt: string | null;
  canCounterNotice: boolean;
  createdAt: string;
}

interface DisableResult {
  disabled: boolean;
  ownerId: string | null;
  mediaState: string;
  mediaUrls: string[];
  voiceNoteUrl: string | null;
}

interface RestoreResult {
  restored: boolean;
  reason: string | null;
  mediaPending: boolean;
}

const OWNER_VISIBLE_EXCLUDED: DmcaNoticeStatus[] = [
  'pending_verification',
  'expired',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const entries: readonly unknown[] = value;
  return entries.filter((entry): entry is string => typeof entry === 'string');
}

function parseDisableResult(data: unknown): DisableResult {
  if (!isRecord(data) || data['disabled'] !== true) {
    return {
      disabled: false,
      ownerId: null,
      mediaState: 'none',
      mediaUrls: [],
      voiceNoteUrl: null,
    };
  }
  return {
    disabled: true,
    ownerId: typeof data['owner_id'] === 'string' ? data['owner_id'] : null,
    mediaState:
      typeof data['media_state'] === 'string' ? data['media_state'] : 'none',
    mediaUrls: stringList(data['media_urls']),
    voiceNoteUrl:
      typeof data['voice_note_url'] === 'string'
        ? data['voice_note_url']
        : null,
  };
}

function parseRestoreResult(data: unknown): RestoreResult {
  if (!isRecord(data)) {
    return { restored: false, reason: 'invalid_response', mediaPending: false };
  }
  return {
    restored: data['restored'] === true,
    reason: typeof data['reason'] === 'string' ? data['reason'] : null,
    mediaPending: data['media_pending'] === true,
  };
}

@Injectable()
export class DmcaService {
  private readonly logger = new Logger(DmcaService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly mediaService: DmcaMediaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Claimant: submit and confirm
  // ---------------------------------------------------------------------------

  /**
   * Stores one pending notice per identified item and emails the claimant a
   * single confirmation link. Nothing is disabled until the mailbox is
   * confirmed, so a forged submission cannot remove anyone's content.
   */
  async submitNotice(
    dto: CreateDmcaNoticeDto,
    now: Date = new Date(),
  ): Promise<DmcaSubmissionResult> {
    const email = normaliseClaimantEmail(dto.claimantEmail);
    await this.assertClaimantWithinLimit(
      email,
      dto.materialReferences.length,
      now,
    );

    const { token, hash } = generateVerificationToken();
    const expiresAt = hoursAfter(now, DMCA_VERIFICATION_TTL_HOURS);
    const rows = dto.materialReferences.map((reference) => ({
      reference: generateNoticeReference(),
      claimant_name: dto.claimantName,
      claimant_email: email,
      claimant_organisation: dto.claimantOrganisation ?? null,
      claimant_address: dto.claimantAddress ?? null,
      claimant_phone: dto.claimantPhone ?? null,
      copyrighted_work: dto.copyrightedWork,
      material_reference: reference,
      good_faith_statement: dto.goodFaithStatement,
      accuracy_statement: dto.accuracyStatement,
      electronic_signature: dto.electronicSignature,
      verification_token_hash: hash,
      verification_expires_at: expiresAt.toISOString(),
    }));

    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('dmca_notices')
      .insert(rows)
      .select('id, reference');
    if (error || !data || data.length !== rows.length) {
      this.logger.error('dmca_notice_insert_failed');
      throw new ServiceUnavailableException('Unable to record the notice');
    }

    const references = data.map((row) => row.reference);
    try {
      const message = verificationEmail({
        references,
        verifyUrl: `${this.frontendUrl()}/dmca/verify?token=${token}`,
        ttlHours: DMCA_VERIFICATION_TTL_HOURS,
      });
      await this.emailService.sendPlainTextEmail(
        email,
        message.subject,
        message.text,
      );
    } catch {
      // A notice the claimant can never confirm is worthless personal data.
      this.logger.error('dmca_verification_email_failed');
      this.metrics?.recordDmcaEvent('verification_email_failed');
      await client
        .from('dmca_notices')
        .delete()
        .in(
          'id',
          data.map((row) => row.id),
        );
      throw new ServiceUnavailableException(
        'Unable to send the confirmation email',
      );
    }

    for (const row of data) {
      await this.recordEvent(row.id, 'notice_submitted', { type: 'claimant' });
    }
    this.metrics?.recordDmcaEvent('notice_received');
    this.logger.log(`dmca_notices_received count=${data.length}`);
    return { references, status: 'pending_verification' };
  }

  /**
   * Confirms the claimant's mailbox and processes every item of the
   * submission. Repeating the call with a used token reports the current state
   * instead of failing, so a double click or a retry is harmless.
   */
  async verifyNotice(
    token: string,
    now: Date = new Date(),
  ): Promise<DmcaVerificationResult> {
    const hash = hashVerificationToken(token);
    const nowIso = now.toISOString();
    const client = this.supabaseService.getClient();

    const { data: claimed, error } = await client
      .from('dmca_notices')
      .update({ verified_at: nowIso, updated_at: nowIso })
      .eq('verification_token_hash', hash)
      .eq('status', 'pending_verification')
      .is('verified_at', null)
      .gt('verification_expires_at', nowIso)
      .select('*');
    if (error) {
      this.logger.error('dmca_verification_claim_failed');
      throw new ServiceUnavailableException('Unable to confirm the notice');
    }

    if (claimed && claimed.length > 0) {
      for (const notice of claimed) {
        await this.recordEvent(notice.id, 'claimant_verified', {
          type: 'claimant',
        });
        try {
          await this.processVerifiedNotice(notice, now);
        } catch {
          // Left verified-but-unprocessed: the maintenance job retries it.
          this.logger.error('dmca_notice_processing_failed');
        }
      }
      return this.statusesFor(claimed.map((notice) => notice.id));
    }

    const { data: existing, error: lookupError } = await client
      .from('dmca_notices')
      .select('id, verified_at')
      .eq('verification_token_hash', hash);
    if (lookupError) {
      throw new ServiceUnavailableException('Unable to confirm the notice');
    }
    if (!existing || existing.length === 0) {
      throw new NotFoundException('The confirmation link is not valid');
    }
    if (existing.some((row) => row.verified_at !== null)) {
      return this.statusesFor(existing.map((row) => row.id));
    }
    throw new GoneException('The confirmation link has expired');
  }

  // ---------------------------------------------------------------------------
  // System: process a confirmed notice
  // ---------------------------------------------------------------------------

  async processVerifiedNotice(
    notice: DmcaNoticeRow,
    now: Date = new Date(),
  ): Promise<void> {
    const target = await this.resolveTarget(notice.material_reference);
    if (!target) {
      await this.moveToReview(notice, now);
      return;
    }

    const disabled = await this.disableNotice(
      notice,
      target,
      { type: 'system' },
      now,
    );
    if (!disabled) {
      await this.moveToReview(notice, now);
    }
  }

  /**
   * Disables the item and records it on the notice. Returns null when the item
   * no longer exists or the notice was already moved on by another request.
   */
  async disableNotice(
    notice: DmcaNoticeRow,
    target: DmcaTarget,
    actor: DmcaActor,
    now: Date = new Date(),
  ): Promise<DmcaNoticeRow | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('dmca_disable_content', {
      p_target_type: target.type,
      p_target_id: target.id,
    });
    if (error) {
      this.logger.error('dmca_disable_rpc_failed');
      throw new ServiceUnavailableException('Unable to disable the material');
    }

    const result = parseDisableResult(data);
    if (!result.disabled) {
      await this.recordEvent(notice.id, 'target_missing', actor);
      return null;
    }

    const nowIso = now.toISOString();
    const { data: updated, error: updateError } = await client
      .from('dmca_notices')
      .update({
        target_type: target.type,
        target_id: target.id,
        target_owner_id: result.ownerId ?? target.ownerId,
        status: 'content_disabled',
        content_disabled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', notice.id)
      .in('status', ['pending_verification', 'needs_review'])
      .select('*');
    if (updateError) {
      this.logger.error('dmca_notice_update_failed');
      throw new ServiceUnavailableException('Unable to record the notice');
    }

    const current = updated?.[0];
    if (!current) return null;

    await this.recordEvent(current.id, 'content_disabled', actor);
    this.metrics?.recordDmcaEvent('content_disabled');
    this.logger.log('dmca_content_disabled');

    if (result.mediaState === 'none') {
      await this.planMedia(target, result);
    }

    await this.notifyDisabled(current);
    await this.flagRepeatInfringer(current, now);
    return current;
  }

  /**
   * Restores the material (unless another live notice still covers it) and
   * closes the notice. Returns null when the notice is no longer in one of the
   * allowed states, in which case any restoration is undone.
   */
  async closeNotice(
    notice: DmcaNoticeRow,
    outcome: DmcaClosureOutcome,
    allowedFrom: readonly DmcaNoticeStatus[],
    actor: DmcaActor,
    now: Date = new Date(),
  ): Promise<DmcaNoticeRow | null> {
    const client = this.supabaseService.getClient();
    const target =
      notice.target_type && notice.target_id
        ? { type: notice.target_type, id: notice.target_id }
        : null;

    let restoredContent = false;
    if (
      target &&
      DMCA_ACTIVE_STATUSES.some((status) => status === notice.status)
    ) {
      const { data, error } = await client.rpc('dmca_restore_content', {
        p_notice_id: notice.id,
        p_target_type: target.type,
        p_target_id: target.id,
      });
      if (error) {
        this.logger.error('dmca_restore_rpc_failed');
        throw new ServiceUnavailableException('Unable to restore the material');
      }
      const result = parseRestoreResult(data);
      restoredContent = result.restored;
      if (!result.restored && result.reason === 'other_active_notice') {
        await this.recordEvent(
          notice.id,
          'restore_deferred_other_notice',
          actor,
        );
      }
    }

    const nowIso = now.toISOString();
    const { data: updated, error: updateError } = await client
      .from('dmca_notices')
      .update({
        status: outcome,
        closed_at: nowIso,
        restore_after: null,
        updated_at: nowIso,
      })
      .eq('id', notice.id)
      .in('status', [...allowedFrom])
      .select('*');
    if (updateError) {
      this.logger.error('dmca_notice_close_failed');
      throw new ServiceUnavailableException('Unable to close the notice');
    }

    const closed = updated?.[0];
    if (!closed) {
      if (restoredContent && target) {
        // The notice changed state under us (for example a litigation hold):
        // put the takedown back rather than leave the item visible.
        await client.rpc('dmca_disable_content', {
          p_target_type: target.type,
          p_target_id: target.id,
        });
        await this.recordEvent(notice.id, 'restore_rolled_back', actor);
      }
      return null;
    }

    await this.recordEvent(closed.id, `notice_${outcome}`, actor);
    this.metrics?.recordDmcaEvent(
      restoredContent ? 'content_restored' : 'notice_closed',
    );
    this.logger.log(`dmca_notice_closed outcome=${outcome}`);
    await this.notifyClosed(closed, outcome);
    return closed;
  }

  /** Keeps the item disabled and cancels automatic restoration. */
  async holdForLitigation(
    notice: DmcaNoticeRow,
    actor: DmcaActor,
    now: Date = new Date(),
  ): Promise<DmcaNoticeRow | null> {
    const nowIso = now.toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .update({
        status: 'litigation_hold',
        restore_after: null,
        updated_at: nowIso,
      })
      .eq('id', notice.id)
      .in('status', ['content_disabled', 'counter_notice_received'])
      .select('*');
    if (error) {
      throw new ServiceUnavailableException('Unable to update the notice');
    }
    const held = data?.[0];
    if (!held) return null;

    await this.recordEvent(held.id, 'litigation_hold', actor);
    this.metrics?.recordDmcaEvent('litigation_hold');
    return held;
  }

  // ---------------------------------------------------------------------------
  // Content owner
  // ---------------------------------------------------------------------------

  async listOwnerNotices(
    ownerId: string,
    page = 1,
    pageSize = DMCA_PAGE_SIZE_DEFAULT,
  ): Promise<OwnerNoticeView[]> {
    const from = (page - 1) * pageSize;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('*')
      .eq('target_owner_id', ownerId)
      .not('status', 'in', `(${OWNER_VISIBLE_EXCLUDED.join(',')})`)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      this.logger.error('dmca_owner_list_failed');
      throw new ServiceUnavailableException('Unable to load notices');
    }
    return (data ?? []).map((row) => this.toOwnerView(row));
  }

  async submitCounterNotice(
    ownerId: string,
    noticeId: string,
    dto: CreateCounterNoticeDto,
    now: Date = new Date(),
  ): Promise<OwnerNoticeView> {
    const client = this.supabaseService.getClient();
    const notice = await this.findOwnedNotice(ownerId, noticeId);

    if (notice.status === 'counter_notice_received') {
      return this.toOwnerView(notice);
    }
    if (notice.status !== 'content_disabled') {
      throw new ConflictException(
        'A counter-notification cannot be filed for this notice',
      );
    }

    const { error: insertError } = await client
      .from('dmca_counter_notices')
      .upsert(
        {
          notice_id: notice.id,
          submitted_by: ownerId,
          full_name: dto.fullName,
          address: dto.address,
          phone: dto.phone ?? null,
          good_faith_statement: dto.goodFaithStatement,
          jurisdiction_consent: dto.jurisdictionConsent,
          electronic_signature: dto.electronicSignature,
        },
        { onConflict: 'notice_id', ignoreDuplicates: true },
      );
    if (insertError) {
      this.logger.error('dmca_counter_notice_insert_failed');
      throw new ServiceUnavailableException(
        'Unable to record the counter-notification',
      );
    }

    const restoreAfter = addBusinessDays(
      now,
      DMCA_COUNTER_NOTICE_WAIT_BUSINESS_DAYS,
    );
    const nowIso = now.toISOString();
    const { data: updated, error: updateError } = await client
      .from('dmca_notices')
      .update({
        status: 'counter_notice_received',
        counter_notice_at: nowIso,
        restore_after: restoreAfter.toISOString(),
        updated_at: nowIso,
      })
      .eq('id', notice.id)
      .eq('target_owner_id', ownerId)
      .eq('status', 'content_disabled')
      .select('*');
    if (updateError) {
      this.logger.error('dmca_counter_notice_update_failed');
      throw new ServiceUnavailableException(
        'Unable to record the counter-notification',
      );
    }

    const current = updated?.[0];
    if (!current) {
      // Lost a race: report what the winner decided.
      const latest = await this.findOwnedNotice(ownerId, noticeId);
      if (latest.status === 'counter_notice_received') {
        return this.toOwnerView(latest);
      }
      throw new ConflictException(
        'A counter-notification cannot be filed for this notice',
      );
    }

    await this.recordEvent(current.id, 'counter_notice_received', {
      type: 'owner',
      id: ownerId,
    });
    this.metrics?.recordDmcaEvent('counter_notice_received');

    await this.sendEmail(
      current.id,
      'claimant_counter_notice',
      current.claimant_email,
      claimantCounterNoticeEmail({
        reference: current.reference,
        fullName: dto.fullName,
        address: dto.address,
        phone: dto.phone ?? null,
        restoreAfter,
      }),
    );
    await this.sendEmail(
      current.id,
      'owner_counter_notice',
      await this.ownerEmail(ownerId),
      ownerCounterNoticeEmail({ reference: current.reference, restoreAfter }),
    );
    return this.toOwnerView(current);
  }

  // ---------------------------------------------------------------------------
  // Shared helpers (also used by the operator and maintenance services)
  // ---------------------------------------------------------------------------

  async recordEvent(
    noticeId: string,
    event: string,
    actor: DmcaActor,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('dmca_notice_events')
        .insert({
          notice_id: noticeId,
          event,
          actor_type: actor.type,
          actor_id: actor.id ?? null,
        });
      if (error) this.logger.error('dmca_event_write_failed');
    } catch {
      this.logger.error('dmca_event_write_failed');
    }
  }

  /** Moves hosted files of newly disabled or restored items; safe to repeat. */
  async syncPendingMedia(limit: number = DMCA_BATCH_SIZE): Promise<number> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('dmca_content_snapshots')
      .select('target_type, target_id, media_state, media_objects')
      .in('media_state', ['pending_quarantine', 'pending_restore'])
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) {
      this.logger.error('dmca_media_sync_query_failed');
      throw new ServiceUnavailableException('Media sync unavailable');
    }

    let completed = 0;
    for (const snapshot of data ?? []) {
      const objects = this.mediaService.parse(snapshot.media_objects);

      if (snapshot.media_state === 'pending_quarantine') {
        const outcome = await this.mediaService.quarantine(objects);
        const nextState =
          outcome.failed === 0 ? 'quarantined' : 'pending_quarantine';
        await client
          .from('dmca_content_snapshots')
          .update({ media_objects: outcome.objects, media_state: nextState })
          .eq('target_type', snapshot.target_type)
          .eq('target_id', snapshot.target_id)
          .eq('media_state', 'pending_quarantine');
        this.metrics?.recordDmcaEvent(
          outcome.failed === 0
            ? 'media_quarantined'
            : 'media_quarantine_failed',
        );
        if (outcome.failed === 0) completed += 1;
      } else {
        const outcome = await this.mediaService.restore(objects);
        if (outcome.failed === 0) {
          await client
            .from('dmca_content_snapshots')
            .delete()
            .eq('target_type', snapshot.target_type)
            .eq('target_id', snapshot.target_id)
            .eq('media_state', 'pending_restore');
          completed += 1;
        }
        this.metrics?.recordDmcaEvent(
          outcome.failed === 0 ? 'media_restored' : 'media_restore_failed',
        );
      }
    }
    return completed;
  }

  /** Starts file movement without making the caller wait for large uploads. */
  scheduleMediaSync(): void {
    this.syncPendingMedia().catch(() => {
      this.logger.error('dmca_media_sync_failed');
    });
  }

  async findNotice(noticeId: string): Promise<DmcaNoticeRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('*')
      .eq('id', noticeId)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException('Unable to load the notice');
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async assertClaimantWithinLimit(
    email: string,
    incoming: number,
    now: Date,
  ): Promise<void> {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('id', { count: 'exact', head: true })
      .eq('claimant_email', email)
      .gte('created_at', daysBefore(now, 1).toISOString());
    if (error) {
      this.logger.error('dmca_claimant_limit_query_failed');
      throw new ServiceUnavailableException('Unable to record the notice');
    }
    if ((count ?? 0) + incoming > DMCA_MAX_NOTICES_PER_CLAIMANT_PER_DAY) {
      throw new HttpException(
        'Too many notices from this address today',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async resolveTarget(reference: string): Promise<DmcaTarget | null> {
    const publicBase =
      this.configService.get<string>('CLOUDFLARE_R2_PUBLIC_URL') ?? '';
    const parsed = parseMaterialReference(reference, publicBase);
    const client = this.supabaseService.getClient();

    if (parsed.kind === 'id') {
      const { data: moment } = await client
        .from('moments')
        .select('id, user_id')
        .eq('id', parsed.id)
        .maybeSingle();
      if (moment?.user_id) {
        return { type: 'moment', id: parsed.id, ownerId: moment.user_id };
      }
      const { data: comment } = await client
        .from('moment_comments')
        .select('id, user_id')
        .eq('id', parsed.id)
        .maybeSingle();
      if (comment?.user_id) {
        return {
          type: 'moment_comment',
          id: parsed.id,
          ownerId: comment.user_id,
        };
      }
      return null;
    }

    if (parsed.kind === 'media') {
      // The key names the owning account, so the search stays within it.
      const { data: byMedia } = await client
        .from('moments')
        .select('id, user_id')
        .eq('user_id', parsed.ownerId)
        .contains('media_urls', [parsed.url])
        .limit(1);
      const { data: byVoice } = byMedia?.length
        ? { data: null }
        : await client
            .from('moments')
            .select('id, user_id')
            .eq('user_id', parsed.ownerId)
            .eq('voice_note_url', parsed.url)
            .limit(1);
      const moment = byMedia?.[0] ?? byVoice?.[0];
      if (moment?.user_id) {
        return { type: 'moment', id: moment.id, ownerId: moment.user_id };
      }

      // Already disabled by an earlier notice: the original now lives in the snapshot.
      for (const needle of [
        { media_urls: [parsed.url] },
        { voice_note_url: parsed.url },
      ]) {
        const { data: snapshots } = await client
          .from('dmca_content_snapshots')
          .select('target_type, target_id, owner_id')
          .eq('owner_id', parsed.ownerId)
          .contains('snapshot', needle)
          .limit(1);
        const snapshot = snapshots?.[0];
        if (snapshot && isDmcaTargetType(snapshot.target_type)) {
          return {
            type: snapshot.target_type,
            id: snapshot.target_id,
            ownerId: snapshot.owner_id,
          };
        }
      }
    }
    return null;
  }

  private async moveToReview(notice: DmcaNoticeRow, now: Date): Promise<void> {
    const nowIso = now.toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .update({ status: 'needs_review', updated_at: nowIso })
      .eq('id', notice.id)
      .eq('status', 'pending_verification')
      .select('id');
    if (error) {
      throw new ServiceUnavailableException('Unable to record the notice');
    }
    if (!data?.length) return;

    await this.recordEvent(notice.id, 'target_unresolved', { type: 'system' });
    this.metrics?.recordDmcaEvent('needs_review');
    await this.sendEmail(
      notice.id,
      'claimant_needs_review',
      notice.claimant_email,
      claimantNeedsReviewEmail({ reference: notice.reference }),
    );
  }

  private async planMedia(
    target: DmcaTarget,
    result: DisableResult,
  ): Promise<void> {
    const urls = result.voiceNoteUrl
      ? [...result.mediaUrls, result.voiceNoteUrl]
      : result.mediaUrls;
    const objects = this.mediaService.plan(target.type, target.id, urls);
    if (objects.length === 0) return;

    const { error } = await this.supabaseService
      .getClient()
      .from('dmca_content_snapshots')
      .update({ media_state: 'pending_quarantine', media_objects: objects })
      .eq('target_type', target.type)
      .eq('target_id', target.id)
      .eq('media_state', 'none');
    if (error) {
      this.logger.error('dmca_media_plan_failed');
      return;
    }
    this.scheduleMediaSync();
  }

  private async notifyDisabled(notice: DmcaNoticeRow): Promise<void> {
    await this.sendEmail(
      notice.id,
      'claimant_content_disabled',
      notice.claimant_email,
      claimantContentDisabledEmail({
        reference: notice.reference,
        waitBusinessDays: DMCA_COUNTER_NOTICE_WAIT_BUSINESS_DAYS,
      }),
    );

    if (!notice.target_owner_id || !notice.target_type) return;
    await this.sendEmail(
      notice.id,
      'owner_content_disabled',
      await this.ownerEmail(notice.target_owner_id),
      ownerContentDisabledEmail({
        reference: notice.reference,
        claimantName: notice.claimant_name,
        claimantOrganisation: notice.claimant_organisation,
        claimantEmail: notice.claimant_email,
        copyrightedWork: notice.copyrighted_work,
        kind: notice.target_type,
        manageUrl: `${this.frontendUrl()}/settings/copyright-notices`,
        waitBusinessDays: DMCA_COUNTER_NOTICE_WAIT_BUSINESS_DAYS,
      }),
    );
  }

  private async notifyClosed(
    notice: DmcaNoticeRow,
    outcome: DmcaClosureOutcome,
  ): Promise<void> {
    await this.sendEmail(
      notice.id,
      'claimant_closed',
      notice.claimant_email,
      closureEmail({
        reference: notice.reference,
        outcome,
        audience: 'claimant',
      }),
    );
    if (notice.target_owner_id) {
      await this.sendEmail(
        notice.id,
        'owner_closed',
        await this.ownerEmail(notice.target_owner_id),
        closureEmail({
          reference: notice.reference,
          outcome,
          audience: 'owner',
        }),
      );
    }
  }

  /**
   * Queues the owner for human review once they accumulate several live
   * notices inside the strike window. Accounts are never closed automatically.
   */
  private async flagRepeatInfringer(
    notice: DmcaNoticeRow,
    now: Date,
  ): Promise<void> {
    const ownerId = notice.target_owner_id;
    if (!ownerId) return;

    const client = this.supabaseService.getClient();
    const { count, error } = await client
      .from('dmca_notices')
      .select('id', { count: 'exact', head: true })
      .eq('target_owner_id', ownerId)
      .in('status', [...DMCA_ACTIVE_STATUSES])
      .gte(
        'content_disabled_at',
        monthsBefore(now, DMCA_STRIKE_WINDOW_MONTHS).toISOString(),
      );
    if (error || (count ?? 0) < DMCA_REPEAT_INFRINGER_THRESHOLD) return;

    const { data: open } = await client
      .from('reports')
      .select('id')
      .eq('reported_user_id', ownerId)
      .eq('reason_category', DMCA_REPEAT_INFRINGER_REASON)
      .eq('status', 'pending')
      .limit(1);
    if (open?.length) return;

    const { error: insertError } = await client.from('reports').insert({
      reporter_id: null,
      reported_user_id: ownerId,
      reason_category: DMCA_REPEAT_INFRINGER_REASON,
      description: `Repeat infringer review: ${count} live copyright notices in ${DMCA_STRIKE_WINDOW_MONTHS} months`,
      status: 'pending',
    });
    if (insertError) {
      this.logger.error('dmca_repeat_infringer_flag_failed');
      return;
    }
    await this.recordEvent(notice.id, 'repeat_infringer_flagged', {
      type: 'system',
    });
    this.metrics?.recordDmcaEvent('repeat_infringer_flagged');
  }

  private async findOwnedNotice(
    ownerId: string,
    noticeId: string,
  ): Promise<DmcaNoticeRow> {
    const notice = await this.findNotice(noticeId);
    // Unknown and not-yours look identical so identifiers cannot be probed.
    if (!notice || notice.target_owner_id !== ownerId) {
      throw new NotFoundException('Notice not found');
    }
    return notice;
  }

  private async statusesFor(ids: string[]): Promise<DmcaVerificationResult> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select('reference, status')
      .in('id', ids)
      .order('created_at', { ascending: true });
    if (error) {
      throw new ServiceUnavailableException('Unable to load the notice');
    }
    return {
      notices: (data ?? []).map((row) => ({
        reference: row.reference,
        status: row.status,
      })),
    };
  }

  private async ownerEmail(ownerId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .auth.admin.getUserById(ownerId);
      return error ? null : (data.user?.email ?? null);
    } catch {
      return null;
    }
  }

  private async sendEmail(
    noticeId: string,
    kind: string,
    to: string | null,
    message: DmcaEmail,
  ): Promise<void> {
    if (!to) {
      await this.recordEvent(noticeId, `${kind}_skipped`, { type: 'system' });
      return;
    }
    try {
      await this.emailService.sendPlainTextEmail(
        to,
        message.subject,
        message.text,
      );
    } catch {
      // Correlate by notice reference without exposing the address.
      this.logger.error(`dmca_email_failed kind=${kind}`);
      this.metrics?.recordDmcaEvent('email_failed');
      await this.recordEvent(noticeId, `${kind}_email_failed`, {
        type: 'system',
      });
    }
  }

  private toOwnerView(row: DmcaNoticeRow): OwnerNoticeView {
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      targetType: row.target_type,
      claimantName: row.claimant_name,
      claimantOrganisation: row.claimant_organisation,
      copyrightedWork: row.copyrighted_work,
      contentDisabledAt: row.content_disabled_at,
      counterNoticeAt: row.counter_notice_at,
      restoreAfter: row.restore_after,
      closedAt: row.closed_at,
      canCounterNotice: row.status === 'content_disabled',
      createdAt: row.created_at,
    };
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200'
    ).replace(/\/+$/, '');
  }
}
