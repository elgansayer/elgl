import {
  ConflictException,
  GoneException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { MetricsService } from '../metrics/metrics.service';
import { DmcaNoticeRow, SupabaseService } from '../supabase/supabase.service';
import { createSupabaseDouble } from '../../test/support/supabase-double';
import { DmcaMediaService } from './dmca-media.service';
import { hashVerificationToken } from './dmca-policy';
import { DmcaService } from './dmca.service';
import { CreateCounterNoticeDto } from './dto/create-counter-notice.dto';
import { CreateDmcaNoticeDto } from './dto/create-dmca-notice.dto';

const NOW = new Date('2026-11-11T10:00:00.000Z');
const OWNER = '3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b';
const MOMENT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const PUBLIC_BASE = 'https://cdn.example.com';

function notice(overrides: Partial<DmcaNoticeRow> = {}): DmcaNoticeRow {
  return {
    id: 'notice-1',
    reference: 'DMCA-ABCDEFGHJK',
    status: 'pending_verification',
    claimant_name: 'Ana Costa',
    claimant_email: 'ana@example.com',
    claimant_organisation: 'Costa Music',
    claimant_address: null,
    claimant_phone: null,
    copyrighted_work: 'The song "Mar" (2019)',
    material_reference: MOMENT,
    good_faith_statement: true,
    accuracy_statement: true,
    electronic_signature: 'Ana Costa',
    target_type: null,
    target_id: null,
    target_owner_id: null,
    verification_token_hash: null,
    verification_expires_at: null,
    verified_at: NOW.toISOString(),
    content_disabled_at: null,
    counter_notice_at: null,
    restore_after: null,
    closed_at: null,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

const disabledNotice = (overrides: Partial<DmcaNoticeRow> = {}) =>
  notice({
    status: 'content_disabled',
    target_type: 'moment',
    target_id: MOMENT,
    target_owner_id: OWNER,
    content_disabled_at: NOW.toISOString(),
    ...overrides,
  });

const submission = (
  overrides: Partial<CreateDmcaNoticeDto> = {},
): CreateDmcaNoticeDto =>
  Object.assign(new CreateDmcaNoticeDto(), {
    claimantName: 'Ana Costa',
    claimantEmail: 'Ana@Example.com',
    claimantOrganisation: 'Costa Music',
    copyrightedWork: 'The song "Mar" (2019)',
    materialReferences: [MOMENT],
    goodFaithStatement: true,
    accuracyStatement: true,
    electronicSignature: 'Ana Costa',
    ...overrides,
  });

describe('DmcaService', () => {
  let db: ReturnType<typeof createSupabaseDouble>;
  let sendPlainTextEmail: ReturnType<typeof vi.fn>;
  let recordDmcaEvent: ReturnType<typeof vi.fn>;
  let media: {
    plan: ReturnType<typeof vi.fn>;
    parse: ReturnType<typeof vi.fn>;
    quarantine: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
  let service: DmcaService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    db = createSupabaseDouble();
    db.getUserById.mockResolvedValue({
      data: { user: { email: 'owner@example.com' } },
      error: null,
    });
    sendPlainTextEmail = vi.fn().mockResolvedValue(undefined);
    recordDmcaEvent = vi.fn();
    media = {
      plan: vi.fn().mockReturnValue([]),
      parse: vi.fn().mockReturnValue([]),
      quarantine: vi.fn().mockResolvedValue({ objects: [], failed: 0 }),
      restore: vi.fn().mockResolvedValue({ failed: 0 }),
    };

    service = new DmcaService(
      { getClient: () => db.client } as unknown as SupabaseService,
      {
        get: (key: string) =>
          ({
            FRONTEND_URL: 'https://app.example.com/',
            CLOUDFLARE_R2_PUBLIC_URL: PUBLIC_BASE,
          })[key],
      } as unknown as ConfigService,
      { sendPlainTextEmail } as unknown as EmailService,
      media as unknown as DmcaMediaService,
      { recordDmcaEvent } as unknown as MetricsService,
    );
  });

  const emailsTo = (address: string) =>
    sendPlainTextEmail.mock.calls.filter((call) => call[0] === address);
  const eventNames = () =>
    db
      .queries('dmca_notice_events', 'insert')
      .map((entry) => (db.payload(entry, 'insert') as { event: string }).event);

  describe('submitNotice', () => {
    it('stores one pending row per item behind a single hashed token and emails the link once', async () => {
      db.on('dmca_notices', 'select', { count: 0 });
      db.on('dmca_notices', 'insert', {
        data: [
          { id: 'n1', reference: 'DMCA-AAAAAAAAAA' },
          { id: 'n2', reference: 'DMCA-BBBBBBBBBB' },
        ],
      });

      const result = await service.submitNotice(
        submission({ materialReferences: [MOMENT, 'second'] }),
        NOW,
      );

      expect(result).toEqual({
        references: ['DMCA-AAAAAAAAAA', 'DMCA-BBBBBBBBBB'],
        status: 'pending_verification',
      });

      const rows = db.payload(
        db.queries('dmca_notices', 'insert')[0],
        'insert',
      ) as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.verification_token_hash)).size).toBe(
        1,
      );
      expect(rows[0]).toMatchObject({
        claimant_email: 'ana@example.com',
        material_reference: MOMENT,
        good_faith_statement: true,
        accuracy_statement: true,
        verification_expires_at: '2026-11-14T10:00:00.000Z',
      });
      expect(rows[1]?.material_reference).toBe('second');

      expect(sendPlainTextEmail).toHaveBeenCalledTimes(1);
      const [to, subject, text] = sendPlainTextEmail.mock.calls[0] as string[];
      expect(to).toBe('ana@example.com');
      expect(subject).toBe('Confirm your copyright notice');
      const token = /token=([A-Za-z0-9_-]{43})/.exec(text ?? '')?.[1] ?? '';
      expect(text).toContain('https://app.example.com/dmca/verify?token=');
      expect(hashVerificationToken(token)).toBe(
        rows[0]?.verification_token_hash,
      );
      // The raw token is only ever in the email.
      expect(db.everything()).not.toContain(token);
      expect(eventNames()).toEqual(['notice_submitted', 'notice_submitted']);
      expect(recordDmcaEvent).toHaveBeenCalledWith('notice_received');
    });

    it('refuses a mailbox that has reached its daily cap, before writing anything', async () => {
      db.on('dmca_notices', 'select', { count: 29 });

      const attempt = service.submitNotice(
        submission({ materialReferences: ['a', 'b'] }),
        NOW,
      );

      await expect(attempt).rejects.toBeInstanceOf(HttpException);
      await expect(attempt).rejects.toMatchObject({ status: 429 });
      expect(db.queries('dmca_notices', 'insert')).toHaveLength(0);
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it('counts only the last day when applying the cap', async () => {
      db.on('dmca_notices', 'select', { count: 0 });
      db.on('dmca_notices', 'insert', {
        data: [{ id: 'n1', reference: 'DMCA-AAAAAAAAAA' }],
      });

      await service.submitNotice(submission(), NOW);

      const countQuery = db.queries('dmca_notices', 'select')[0];
      expect(
        db.hasCall(countQuery, 'eq', 'claimant_email', 'ana@example.com'),
      ).toBe(true);
      expect(
        db.hasCall(countQuery, 'gte', 'created_at', '2026-11-10T10:00:00.000Z'),
      ).toBe(true);
    });

    it('removes the rows and reports unavailable when the confirmation email cannot be sent', async () => {
      db.on('dmca_notices', 'select', { count: 0 });
      db.on('dmca_notices', 'insert', {
        data: [{ id: 'n1', reference: 'DMCA-AAAAAAAAAA' }],
      });
      sendPlainTextEmail.mockRejectedValue(
        new Error('smtp down ana@example.com'),
      );

      await expect(
        service.submitNotice(submission(), NOW),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      const cleanup = db.queries('dmca_notices', 'delete')[0];
      expect(db.hasCall(cleanup, 'in', 'id', ['n1'])).toBe(true);
      expect(db.queries('dmca_notice_events', 'insert')).toHaveLength(0);
      expect(
        JSON.stringify(vi.mocked(Logger.prototype.error).mock.calls),
      ).not.toContain('ana@example.com');
    });

    it('reports unavailable when the insert fails', async () => {
      db.on('dmca_notices', 'select', { count: 0 });
      db.on('dmca_notices', 'insert', {
        data: null,
        error: { message: 'boom' },
      });

      await expect(
        service.submitNotice(submission(), NOW),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyNotice', () => {
    const token = 'A'.repeat(43);

    it('claims every unconfirmed row of the submission exactly once and processes them', async () => {
      const pending = notice();
      db.on('dmca_notices', 'update', { data: [pending] });
      // processVerifiedNotice: target lookup misses everywhere -> needs review
      db.on('moments', 'select', { data: null });
      db.on('moment_comments', 'select', { data: null });
      db.on('dmca_notices', 'update', { data: [{ id: pending.id }] });
      db.on('dmca_notices', 'select', {
        data: [{ reference: pending.reference, status: 'needs_review' }],
      });

      const result = await service.verifyNotice(token, NOW);

      const claim = db.queries('dmca_notices', 'update')[0];
      expect(
        db.hasCall(
          claim,
          'eq',
          'verification_token_hash',
          hashVerificationToken(token),
        ),
      ).toBe(true);
      expect(db.hasCall(claim, 'eq', 'status', 'pending_verification')).toBe(
        true,
      );
      expect(db.hasCall(claim, 'is', 'verified_at', null)).toBe(true);
      expect(
        db.hasCall(claim, 'gt', 'verification_expires_at', NOW.toISOString()),
      ).toBe(true);
      expect(eventNames()).toContain('claimant_verified');
      expect(result).toEqual({
        notices: [{ reference: 'DMCA-ABCDEFGHJK', status: 'needs_review' }],
      });
    });

    it('rejects a token that matches nothing', async () => {
      db.on('dmca_notices', 'update', { data: [] });
      db.on('dmca_notices', 'select', { data: [] });

      await expect(service.verifyNotice(token, NOW)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('reports an expired confirmation window as gone', async () => {
      db.on('dmca_notices', 'update', { data: [] });
      db.on('dmca_notices', 'select', {
        data: [{ id: 'n1', verified_at: null }],
      });

      await expect(service.verifyNotice(token, NOW)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('is idempotent: a used token reports state without reprocessing', async () => {
      db.on('dmca_notices', 'update', { data: [] });
      db.on(
        'dmca_notices',
        'select',
        { data: [{ id: 'n1', verified_at: NOW.toISOString() }] },
        {
          data: [{ reference: 'DMCA-ABCDEFGHJK', status: 'content_disabled' }],
        },
      );

      await expect(service.verifyNotice(token, NOW)).resolves.toEqual({
        notices: [{ reference: 'DMCA-ABCDEFGHJK', status: 'content_disabled' }],
      });
      expect(db.rpcCalls('dmca_disable_content')).toHaveLength(0);
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it('still answers when one item fails to process, leaving it for the maintenance job', async () => {
      db.on('dmca_notices', 'update', { data: [notice()] });
      db.on('moments', 'select', {
        data: { id: MOMENT, user_id: OWNER },
      });
      db.onRpc('dmca_disable_content', {
        data: null,
        error: { message: 'down' },
      });
      db.on('dmca_notices', 'select', {
        data: [
          { reference: 'DMCA-ABCDEFGHJK', status: 'pending_verification' },
        ],
      });

      await expect(service.verifyNotice(token, NOW)).resolves.toEqual({
        notices: [
          { reference: 'DMCA-ABCDEFGHJK', status: 'pending_verification' },
        ],
      });
      expect(vi.mocked(Logger.prototype.error)).toHaveBeenCalledWith(
        'dmca_notice_processing_failed',
      );
    });
  });

  describe('processVerifiedNotice', () => {
    const disabledResult = (extra: Record<string, unknown> = {}) => ({
      data: {
        disabled: true,
        owner_id: OWNER,
        media_state: 'none',
        media_urls: [],
        voice_note_url: null,
        ...extra,
      },
    });

    it('disables a Moment found by identifier and tells the claimant and the owner', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 1 });

      await service.processVerifiedNotice(notice(), NOW);

      expect(db.rpcCalls('dmca_disable_content')[0]?.args).toEqual({
        p_target_type: 'moment',
        p_target_id: MOMENT,
      });
      const update = db.queries('dmca_notices', 'update')[0];
      expect(db.payload(update, 'update')).toMatchObject({
        target_type: 'moment',
        target_id: MOMENT,
        target_owner_id: OWNER,
        status: 'content_disabled',
        content_disabled_at: NOW.toISOString(),
      });
      // Only an unconfirmed or under-review notice may be disabled.
      expect(
        db.hasCall(update, 'in', 'status', [
          'pending_verification',
          'needs_review',
        ]),
      ).toBe(true);

      expect(emailsTo('ana@example.com')[0]?.[1]).toBe(
        'Copyright notice DMCA-ABCDEFGHJK: material disabled',
      );
      const ownerEmail = emailsTo('owner@example.com')[0];
      expect(ownerEmail?.[1]).toBe(
        'Copyright notice DMCA-ABCDEFGHJK: your content was disabled',
      );
      expect(ownerEmail?.[2]).toContain(
        'https://app.example.com/settings/copyright-notices',
      );
      expect(eventNames()).toContain('content_disabled');
      expect(recordDmcaEvent).toHaveBeenCalledWith('content_disabled');
    });

    it('finds a comment when the identifier is not a Moment', async () => {
      db.on('moments', 'select', { data: null });
      db.on('moment_comments', 'select', {
        data: { id: MOMENT, user_id: OWNER },
      });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', {
        data: [disabledNotice({ target_type: 'moment_comment' })],
      });
      db.on('dmca_notices', 'select', { count: 1 });

      await service.processVerifiedNotice(notice(), NOW);

      expect(db.rpcCalls('dmca_disable_content')[0]?.args).toMatchObject({
        p_target_type: 'moment_comment',
      });
    });

    it('locates a Moment from an uploaded file URL within the named account only', async () => {
      const url = `${PUBLIC_BASE}/moments/${OWNER}/1700-ab12.jpg`;
      db.on('moments', 'select', { data: [{ id: MOMENT, user_id: OWNER }] });
      db.onRpc('dmca_disable_content', disabledResult({ media_urls: [url] }));
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 1 });

      await service.processVerifiedNotice(
        notice({ material_reference: url }),
        NOW,
      );

      const lookup = db.queries('moments', 'select')[0];
      expect(db.hasCall(lookup, 'eq', 'user_id', OWNER)).toBe(true);
      expect(db.hasCall(lookup, 'contains', 'media_urls', [url])).toBe(true);
      expect(db.rpcCalls('dmca_disable_content')[0]?.args).toEqual({
        p_target_type: 'moment',
        p_target_id: MOMENT,
      });
    });

    it('plans the move of hosted files for a freshly disabled Moment', async () => {
      const url = `${PUBLIC_BASE}/moments/${OWNER}/a.jpg`;
      const planned = [
        {
          url,
          key: `moments/${OWNER}/a.jpg`,
          quarantineKey: 'dmca-quarantine/moment/x/0',
          contentType: null,
        },
      ];
      media.plan.mockReturnValue(planned);
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc(
        'dmca_disable_content',
        disabledResult({
          media_urls: [url],
          voice_note_url: `${PUBLIC_BASE}/v.ogg`,
        }),
      );
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 1 });
      db.on('dmca_content_snapshots', 'update', { data: null });
      db.on('dmca_content_snapshots', 'select', { data: [] });

      await service.processVerifiedNotice(notice(), NOW);

      expect(media.plan).toHaveBeenCalledWith('moment', MOMENT, [
        url,
        `${PUBLIC_BASE}/v.ogg`,
      ]);
      const plan = db.queries('dmca_content_snapshots', 'update')[0];
      expect(db.payload(plan, 'update')).toEqual({
        media_state: 'pending_quarantine',
        media_objects: planned,
      });
      // Only claimed once, even if another notice covers the same item.
      expect(db.hasCall(plan, 'eq', 'media_state', 'none')).toBe(true);
    });

    it('does not plan a second move when the item was already disabled by another notice', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc(
        'dmca_disable_content',
        disabledResult({ media_state: 'quarantined' }),
      );
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 2 });

      await service.processVerifiedNotice(notice(), NOW);

      expect(media.plan).not.toHaveBeenCalled();
      expect(db.queries('dmca_content_snapshots', 'update')).toHaveLength(0);
    });

    it('sends material it cannot locate to review and says so', async () => {
      db.on('moments', 'select', { data: null });
      db.on('moment_comments', 'select', { data: null });
      db.on('dmca_notices', 'update', { data: [{ id: 'notice-1' }] });

      await service.processVerifiedNotice(notice(), NOW);

      expect(db.rpcCalls('dmca_disable_content')).toHaveLength(0);
      expect(
        db.payload(db.queries('dmca_notices', 'update')[0], 'update'),
      ).toMatchObject({
        status: 'needs_review',
      });
      expect(eventNames()).toContain('target_unresolved');
      expect(emailsTo('ana@example.com')[0]?.[1]).toBe(
        'Copyright notice DMCA-ABCDEFGHJK: under review',
      );
      expect(emailsTo('owner@example.com')).toHaveLength(0);
    });

    it('treats an unreadable reference as unlocatable rather than guessing', async () => {
      db.on('dmca_notices', 'update', { data: [{ id: 'notice-1' }] });

      await service.processVerifiedNotice(
        notice({ material_reference: 'a photo of my dog' }),
        NOW,
      );

      expect(db.queries('moments')).toHaveLength(0);
      expect(
        db.payload(db.queries('dmca_notices', 'update')[0], 'update'),
      ).toMatchObject({
        status: 'needs_review',
      });
    });

    it('sends the notice to review when the item vanished before it could be disabled', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', { data: { disabled: false } });
      db.on('dmca_notices', 'update', { data: [{ id: 'notice-1' }] });

      await service.processVerifiedNotice(notice(), NOW);

      expect(eventNames()).toEqual(
        expect.arrayContaining(['target_missing', 'target_unresolved']),
      );
    });

    it('does nothing further when another request already moved the notice on', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [] });
      db.on('dmca_notices', 'update', { data: [] });

      await service.processVerifiedNotice(notice(), NOW);

      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it('queues an owner with three live notices for human review exactly once', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 3 });
      db.on('reports', 'select', { data: [] });
      db.on('reports', 'insert', { data: null });

      await service.processVerifiedNotice(notice(), NOW);

      expect(db.payload(db.queries('reports', 'insert')[0], 'insert')).toEqual({
        reporter_id: null,
        reported_user_id: OWNER,
        reason_category: 'copyright_repeat_infringer',
        description:
          'Repeat infringer review: 3 live copyright notices in 12 months',
        status: 'pending',
      });
      expect(eventNames()).toContain('repeat_infringer_flagged');

      // A second flag while one is open is suppressed.
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 4 });
      db.on('reports', 'select', { data: [{ id: 'open-report' }] });
      await service.processVerifiedNotice(notice(), NOW);
      expect(db.queries('reports', 'insert')).toHaveLength(1);
    });

    it('does not flag an owner below the threshold', async () => {
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 2 });

      await service.processVerifiedNotice(notice(), NOW);

      expect(db.queries('reports')).toHaveLength(0);
    });

    it('records email failures against the notice without logging addresses or aborting', async () => {
      sendPlainTextEmail.mockRejectedValue(
        new Error('smtp down owner@example.com'),
      );
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 1 });

      await expect(
        service.processVerifiedNotice(notice(), NOW),
      ).resolves.toBeUndefined();

      expect(eventNames()).toEqual(
        expect.arrayContaining([
          'claimant_content_disabled_email_failed',
          'owner_content_disabled_email_failed',
        ]),
      );
      expect(recordDmcaEvent).toHaveBeenCalledWith('email_failed');
      const logged = JSON.stringify(
        vi.mocked(Logger.prototype.error).mock.calls,
      );
      expect(logged).not.toContain('example.com');
    });

    it('records a skipped owner message when the owner has no email address', async () => {
      db.getUserById.mockResolvedValue({
        data: { user: { email: null } },
        error: null,
      });
      db.on('moments', 'select', { data: { id: MOMENT, user_id: OWNER } });
      db.onRpc('dmca_disable_content', disabledResult());
      db.on('dmca_notices', 'update', { data: [disabledNotice()] });
      db.on('dmca_notices', 'select', { count: 1 });

      await service.processVerifiedNotice(notice(), NOW);

      expect(eventNames()).toContain('owner_content_disabled_skipped');
    });
  });

  describe('closeNotice', () => {
    const actor = { type: 'operator' as const, id: 'op-1' };

    it('restores the material, closes the notice and tells both parties', async () => {
      db.onRpc('dmca_restore_content', {
        data: { restored: true, media_pending: false },
      });
      db.on('dmca_notices', 'update', {
        data: [
          disabledNotice({ status: 'rejected', closed_at: NOW.toISOString() }),
        ],
      });

      const closed = await service.closeNotice(
        disabledNotice(),
        'rejected',
        ['content_disabled'],
        actor,
        NOW,
      );

      expect(closed?.status).toBe('rejected');
      expect(db.rpcCalls('dmca_restore_content')[0]?.args).toEqual({
        p_notice_id: 'notice-1',
        p_target_type: 'moment',
        p_target_id: MOMENT,
      });
      const update = db.queries('dmca_notices', 'update')[0];
      expect(db.payload(update, 'update')).toMatchObject({
        status: 'rejected',
        closed_at: NOW.toISOString(),
        restore_after: null,
      });
      expect(db.hasCall(update, 'in', 'status', ['content_disabled'])).toBe(
        true,
      );
      expect(emailsTo('ana@example.com')).toHaveLength(1);
      expect(emailsTo('owner@example.com')).toHaveLength(1);
      expect(eventNames()).toContain('notice_rejected');
      expect(recordDmcaEvent).toHaveBeenCalledWith('content_restored');
    });

    it('closes the notice but keeps the material down while another notice still covers it', async () => {
      db.onRpc('dmca_restore_content', {
        data: { restored: false, reason: 'other_active_notice' },
      });
      db.on('dmca_notices', 'update', {
        data: [disabledNotice({ status: 'withdrawn' })],
      });

      const closed = await service.closeNotice(
        disabledNotice(),
        'withdrawn',
        ['content_disabled'],
        actor,
        NOW,
      );

      expect(closed?.status).toBe('withdrawn');
      expect(eventNames()).toContain('restore_deferred_other_notice');
      expect(recordDmcaEvent).toHaveBeenCalledWith('notice_closed');
    });

    it('puts the takedown back when the notice changed state while it was being closed', async () => {
      db.onRpc('dmca_restore_content', { data: { restored: true } });
      db.on('dmca_notices', 'update', { data: [] });

      const closed = await service.closeNotice(
        disabledNotice({ status: 'counter_notice_received' }),
        'restored',
        ['counter_notice_received'],
        { type: 'system' },
        NOW,
      );

      expect(closed).toBeNull();
      expect(db.rpcCalls('dmca_disable_content')).toHaveLength(1);
      expect(eventNames()).toContain('restore_rolled_back');
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it('does not close a notice whose material could not be restored', async () => {
      db.onRpc('dmca_restore_content', {
        data: null,
        error: { message: 'down' },
      });

      await expect(
        service.closeNotice(
          disabledNotice(),
          'rejected',
          ['content_disabled'],
          actor,
          NOW,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.queries('dmca_notices', 'update')).toHaveLength(0);
    });

    it('closes a notice that never had material to restore without calling the database function', async () => {
      db.on('dmca_notices', 'update', {
        data: [notice({ status: 'rejected' })],
      });

      await service.closeNotice(
        notice({ status: 'needs_review' }),
        'rejected',
        ['needs_review'],
        actor,
        NOW,
      );

      expect(db.rpcCalls('dmca_restore_content')).toHaveLength(0);
    });
  });

  describe('holdForLitigation', () => {
    it('keeps the material down and cancels the automatic restore', async () => {
      db.on('dmca_notices', 'update', {
        data: [disabledNotice({ status: 'litigation_hold' })],
      });

      const held = await service.holdForLitigation(
        disabledNotice({ status: 'counter_notice_received' }),
        { type: 'operator', id: 'op-1' },
        NOW,
      );

      expect(held?.status).toBe('litigation_hold');
      const update = db.queries('dmca_notices', 'update')[0];
      expect(db.payload(update, 'update')).toMatchObject({
        status: 'litigation_hold',
        restore_after: null,
      });
      expect(
        db.hasCall(update, 'in', 'status', [
          'content_disabled',
          'counter_notice_received',
        ]),
      ).toBe(true);
    });

    it('returns null when the notice is not in a holdable state', async () => {
      db.on('dmca_notices', 'update', { data: [] });
      await expect(
        service.holdForLitigation(
          notice({ status: 'restored' }),
          { type: 'operator' },
          NOW,
        ),
      ).resolves.toBeNull();
    });
  });

  describe('counter-notification', () => {
    const counter = (): CreateCounterNoticeDto =>
      Object.assign(new CreateCounterNoticeDto(), {
        fullName: 'Sam Lee',
        address: '1 Road, Town',
        phone: undefined,
        goodFaithStatement: true,
        jurisdictionConsent: true,
        electronicSignature: 'Sam Lee',
      });

    it('records the statement, schedules restoration ten business days out and informs both parties', async () => {
      db.on('dmca_notices', 'select', { data: disabledNotice() });
      db.on('dmca_counter_notices', 'upsert', { data: null });
      db.on('dmca_notices', 'update', {
        data: [
          disabledNotice({
            status: 'counter_notice_received',
            counter_notice_at: NOW.toISOString(),
            restore_after: '2026-11-25T10:00:00.000Z',
          }),
        ],
      });

      const view = await service.submitCounterNotice(
        OWNER,
        'notice-1',
        counter(),
        NOW,
      );

      expect(view).toMatchObject({
        status: 'counter_notice_received',
        restoreAfter: '2026-11-25T10:00:00.000Z',
        canCounterNotice: false,
      });
      expect(
        db.payload(db.queries('dmca_counter_notices', 'upsert')[0], 'upsert'),
      ).toMatchObject({
        notice_id: 'notice-1',
        submitted_by: OWNER,
        full_name: 'Sam Lee',
        good_faith_statement: true,
        jurisdiction_consent: true,
        phone: null,
      });
      const update = db.queries('dmca_notices', 'update')[0];
      expect(db.payload(update, 'update')).toMatchObject({
        status: 'counter_notice_received',
        restore_after: '2026-11-25T10:00:00.000Z',
      });
      expect(db.hasCall(update, 'eq', 'target_owner_id', OWNER)).toBe(true);
      expect(db.hasCall(update, 'eq', 'status', 'content_disabled')).toBe(true);

      expect(emailsTo('ana@example.com')[0]?.[2]).toContain('Sam Lee');
      expect(emailsTo('owner@example.com')).toHaveLength(1);
      expect(eventNames()).toContain('counter_notice_received');
    });

    it('answers "not found" for a notice that is not about the caller content', async () => {
      db.on('dmca_notices', 'select', {
        data: disabledNotice({ target_owner_id: 'someone-else' }),
      });

      await expect(
        service.submitCounterNotice(OWNER, 'notice-1', counter(), NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.submitCounterNotice(OWNER, 'unknown', counter(), NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.queries('dmca_counter_notices')).toHaveLength(0);
    });

    it('is idempotent once a counter-notification exists', async () => {
      db.on('dmca_notices', 'select', {
        data: disabledNotice({ status: 'counter_notice_received' }),
      });

      const view = await service.submitCounterNotice(
        OWNER,
        'notice-1',
        counter(),
        NOW,
      );

      expect(view.status).toBe('counter_notice_received');
      expect(db.queries('dmca_counter_notices')).toHaveLength(0);
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it.each([
      'restored',
      'rejected',
      'litigation_hold',
      'needs_review',
    ] as const)(
      'refuses a counter-notification on a %s notice',
      async (status) => {
        db.on('dmca_notices', 'select', { data: disabledNotice({ status }) });

        await expect(
          service.submitCounterNotice(OWNER, 'notice-1', counter(), NOW),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('reports the winner when another request changed the notice first', async () => {
      db.on(
        'dmca_notices',
        'select',
        { data: disabledNotice() },
        { data: disabledNotice({ status: 'counter_notice_received' }) },
      );
      db.on('dmca_counter_notices', 'upsert', { data: null });
      db.on('dmca_notices', 'update', { data: [] });

      const view = await service.submitCounterNotice(
        OWNER,
        'notice-1',
        counter(),
        NOW,
      );

      expect(view.status).toBe('counter_notice_received');
      expect(sendPlainTextEmail).not.toHaveBeenCalled();
    });

    it('conflicts when the notice moved to a state that no longer accepts one', async () => {
      db.on(
        'dmca_notices',
        'select',
        { data: disabledNotice() },
        { data: disabledNotice({ status: 'litigation_hold' }) },
      );
      db.on('dmca_counter_notices', 'upsert', { data: null });
      db.on('dmca_notices', 'update', { data: [] });

      await expect(
        service.submitCounterNotice(OWNER, 'notice-1', counter(), NOW),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listOwnerNotices', () => {
    it('shows an owner only confirmed notices about their own content', async () => {
      db.on('dmca_notices', 'select', {
        data: [
          disabledNotice(),
          disabledNotice({ id: 'notice-2', status: 'restored' }),
        ],
      });

      const views = await service.listOwnerNotices(OWNER, 2, 10);

      const query = db.queries('dmca_notices', 'select')[0];
      expect(db.hasCall(query, 'eq', 'target_owner_id', OWNER)).toBe(true);
      expect(
        db.hasCall(
          query,
          'not',
          'status',
          'in',
          '(pending_verification,expired)',
        ),
      ).toBe(true);
      expect(db.hasCall(query, 'range', 10, 19)).toBe(true);
      expect(views.map((view) => [view.id, view.canCounterNotice])).toEqual([
        ['notice-1', true],
        ['notice-2', false],
      ]);
      // Claimant contact details stay in the email, not the API response.
      expect(JSON.stringify(views)).not.toContain('ana@example.com');
    });
  });

  describe('syncPendingMedia', () => {
    const object = {
      url: `${PUBLIC_BASE}/a.jpg`,
      key: 'a.jpg',
      quarantineKey: 'dmca-quarantine/moment/m/0',
      contentType: null,
    };

    it('marks a snapshot quarantined once every file moved', async () => {
      media.parse.mockReturnValue([object]);
      media.quarantine.mockResolvedValue({
        objects: [{ ...object, contentType: 'image/jpeg' }],
        failed: 0,
      });
      db.on('dmca_content_snapshots', 'select', {
        data: [
          {
            target_type: 'moment',
            target_id: MOMENT,
            media_state: 'pending_quarantine',
            media_objects: [object],
          },
        ],
      });

      await expect(service.syncPendingMedia()).resolves.toBe(1);

      const update = db.queries('dmca_content_snapshots', 'update')[0];
      expect(db.payload(update, 'update')).toEqual({
        media_objects: [{ ...object, contentType: 'image/jpeg' }],
        media_state: 'quarantined',
      });
      expect(
        db.hasCall(update, 'eq', 'media_state', 'pending_quarantine'),
      ).toBe(true);
      expect(recordDmcaEvent).toHaveBeenCalledWith('media_quarantined');
    });

    it('leaves a snapshot pending when a file could not be moved so the next run retries', async () => {
      media.parse.mockReturnValue([object]);
      media.quarantine.mockResolvedValue({ objects: [object], failed: 1 });
      db.on('dmca_content_snapshots', 'select', {
        data: [
          {
            target_type: 'moment',
            target_id: MOMENT,
            media_state: 'pending_quarantine',
            media_objects: [object],
          },
        ],
      });

      await expect(service.syncPendingMedia()).resolves.toBe(0);

      expect(
        db.payload(db.queries('dmca_content_snapshots', 'update')[0], 'update'),
      ).toMatchObject({
        media_state: 'pending_quarantine',
      });
      expect(recordDmcaEvent).toHaveBeenCalledWith('media_quarantine_failed');
    });

    it('drops the snapshot after files are restored, and keeps it when they are not', async () => {
      media.parse.mockReturnValue([object]);
      media.restore
        .mockResolvedValueOnce({ failed: 0 })
        .mockResolvedValueOnce({ failed: 2 });
      db.on('dmca_content_snapshots', 'select', {
        data: [
          {
            target_type: 'moment',
            target_id: MOMENT,
            media_state: 'pending_restore',
            media_objects: [object],
          },
          {
            target_type: 'moment',
            target_id: 'other',
            media_state: 'pending_restore',
            media_objects: [object],
          },
        ],
      });

      await expect(service.syncPendingMedia()).resolves.toBe(1);

      const deletions = db.queries('dmca_content_snapshots', 'delete');
      expect(deletions).toHaveLength(1);
      expect(db.hasCall(deletions[0], 'eq', 'target_id', MOMENT)).toBe(true);
      expect(
        db.hasCall(deletions[0], 'eq', 'media_state', 'pending_restore'),
      ).toBe(true);
    });

    it('reports an unavailable database', async () => {
      db.on('dmca_content_snapshots', 'select', {
        data: null,
        error: { message: 'down' },
      });
      await expect(service.syncPendingMedia()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
