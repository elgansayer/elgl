import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { DmcaNoticeRow, SupabaseService } from '../supabase/supabase.service';
import { createSupabaseDouble } from '../../test/support/supabase-double';
import { DMCA_RESTORABLE_STATUSES } from './dmca.constants';
import { DmcaOperatorService } from './dmca-operator.service';
import { DmcaService } from './dmca.service';
import { AdminDmcaDecisionDto } from './dto/admin-dmca.dto';

const MOMENT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OWNER = '3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b';
const NOW = new Date('2026-11-11T10:00:00.000Z');

function row(overrides: Partial<DmcaNoticeRow> = {}): DmcaNoticeRow {
  return {
    id: 'notice-1',
    reference: 'DMCA-ABCDEFGHJK',
    status: 'needs_review',
    claimant_name: 'Ana Costa',
    claimant_email: 'ana@example.com',
    claimant_organisation: null,
    claimant_address: '1 Road',
    claimant_phone: null,
    copyrighted_work: 'The song "Mar"',
    material_reference: 'unclear',
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

const decision = (
  overrides: Partial<AdminDmcaDecisionDto>,
): AdminDmcaDecisionDto =>
  Object.assign(new AdminDmcaDecisionDto(), {
    decision: 'reject',
    reasonCode: 'legal_request',
    ...overrides,
  });

describe('DmcaOperatorService', () => {
  let db: ReturnType<typeof createSupabaseDouble>;
  let dmca: {
    findNotice: ReturnType<typeof vi.fn>;
    disableNotice: ReturnType<typeof vi.fn>;
    closeNotice: ReturnType<typeof vi.fn>;
    holdForLitigation: ReturnType<typeof vi.fn>;
  };
  let service: DmcaOperatorService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    db = createSupabaseDouble();
    dmca = {
      findNotice: vi.fn().mockResolvedValue(row()),
      disableNotice: vi
        .fn()
        .mockResolvedValue(row({ status: 'content_disabled' })),
      closeNotice: vi.fn().mockResolvedValue(row({ status: 'rejected' })),
      holdForLitigation: vi
        .fn()
        .mockResolvedValue(row({ status: 'litigation_hold' })),
    };
    service = new DmcaOperatorService(
      { getClient: () => db.client } as unknown as SupabaseService,
      dmca as unknown as DmcaService,
    );
  });

  describe('list', () => {
    it('returns a bounded, filtered page without claimant contact details', async () => {
      db.on('dmca_notices', 'select', { data: [row()], count: 41 });

      const result = await service.list({
        status: 'needs_review',
        page: 3,
        pageSize: 10,
      });

      const query = db.queries('dmca_notices', 'select')[0];
      expect(db.hasCall(query, 'eq', 'status', 'needs_review')).toBe(true);
      expect(db.hasCall(query, 'range', 20, 29)).toBe(true);
      expect(
        db.hasCall(query, 'order', 'created_at', { ascending: false }),
      ).toBe(true);
      expect(result).toMatchObject({ page: 3, pageSize: 10, total: 41 });
      expect(result.items[0]).toMatchObject({
        id: 'notice-1',
        claimantName: 'Ana Costa',
      });
      expect(JSON.stringify(result)).not.toContain('ana@example.com');
    });

    it('defaults to the first page of the standard size', async () => {
      db.on('dmca_notices', 'select', { data: [], count: 0 });

      await expect(service.list({})).resolves.toMatchObject({
        page: 1,
        pageSize: 25,
        total: 0,
      });
      expect(
        db.hasCall(db.queries('dmca_notices', 'select')[0], 'range', 0, 24),
      ).toBe(true);
    });

    it('reports an unavailable database', async () => {
      db.on('dmca_notices', 'select', {
        data: null,
        error: { message: 'down' },
      });
      await expect(service.list({})).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('get', () => {
    it('adds the event trail, counter-notification and full claimant details', async () => {
      db.on('dmca_notice_events', 'select', {
        data: [
          {
            event: 'content_disabled',
            actor_type: 'system',
            created_at: NOW.toISOString(),
          },
        ],
      });
      db.on('dmca_counter_notices', 'select', {
        data: {
          full_name: 'Sam Lee',
          address: '2 Road',
          phone: null,
          created_at: NOW.toISOString(),
        },
      });

      const detail = await service.get('notice-1');

      expect(detail).toMatchObject({
        claimantEmail: 'ana@example.com',
        materialReference: 'unclear',
        events: [
          {
            event: 'content_disabled',
            actorType: 'system',
            createdAt: NOW.toISOString(),
          },
        ],
        counterNotice: { fullName: 'Sam Lee', address: '2 Road' },
      });
    });

    it('is a 404 for an unknown notice', async () => {
      dmca.findNotice.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('decide', () => {
    it('disables an unlocated notice against material the operator names, after confirming it exists', async () => {
      db.on('moments', 'select', { data: { user_id: OWNER } });

      await service.decide(
        'notice-1',
        'op-1',
        decision({
          decision: 'disable',
          targetType: 'moment',
          targetId: MOMENT,
        }),
        NOW,
      );

      expect(dmca.disableNotice).toHaveBeenCalledWith(
        row(),
        { type: 'moment', id: MOMENT, ownerId: OWNER },
        { type: 'operator', id: 'op-1' },
        NOW,
      );
    });

    it('looks comments up in the comments table', async () => {
      db.on('moment_comments', 'select', { data: { user_id: OWNER } });

      await service.decide(
        'notice-1',
        'op-1',
        decision({
          decision: 'disable',
          targetType: 'moment_comment',
          targetId: MOMENT,
        }),
        NOW,
      );

      expect(db.queries('moment_comments')).toHaveLength(1);
      expect(db.queries('moments')).toHaveLength(0);
    });

    it('refuses to disable a notice that is not awaiting review', async () => {
      dmca.findNotice.mockResolvedValue(row({ status: 'content_disabled' }));

      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({
            decision: 'disable',
            targetType: 'moment',
            targetId: MOMENT,
          }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dmca.disableNotice).not.toHaveBeenCalled();
    });

    it('requires a target when the notice has none', async () => {
      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({ decision: 'disable' }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects material that does not exist', async () => {
      db.on('moments', 'select', { data: null });

      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({
            decision: 'disable',
            targetType: 'moment',
            targetId: MOMENT,
          }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('uses the target already on the notice and ignores a different one in the request', async () => {
      dmca.findNotice.mockResolvedValue(
        row({ target_type: 'moment', target_id: MOMENT }),
      );
      db.on('moments', 'select', { data: { user_id: OWNER } });

      await service.decide(
        'notice-1',
        'op-1',
        decision({
          decision: 'disable',
          targetType: 'moment_comment',
          targetId: OWNER,
        }),
        NOW,
      );

      expect(dmca.disableNotice).toHaveBeenCalledWith(
        expect.anything(),
        { type: 'moment', id: MOMENT, ownerId: OWNER },
        expect.anything(),
        NOW,
      );
    });

    it('conflicts when the notice could not be applied', async () => {
      dmca.disableNotice.mockResolvedValue(null);
      db.on('moments', 'select', { data: { user_id: OWNER } });

      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({
            decision: 'disable',
            targetType: 'moment',
            targetId: MOMENT,
          }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      ['reject', 'rejected'],
      ['withdraw', 'withdrawn'],
    ] as const)(
      '%s closes the notice as %s from any live state',
      async (verb, outcome) => {
        await service.decide(
          'notice-1',
          'op-1',
          decision({ decision: verb }),
          NOW,
        );

        expect(dmca.closeNotice).toHaveBeenCalledWith(
          row(),
          outcome,
          DMCA_RESTORABLE_STATUSES,
          { type: 'operator', id: 'op-1' },
          NOW,
        );
      },
    );

    it('conflicts when closing lost a race', async () => {
      dmca.closeNotice.mockResolvedValue(null);
      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({ decision: 'reject' }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('places a notice on litigation hold', async () => {
      await service.decide(
        'notice-1',
        'op-1',
        decision({ decision: 'litigation_hold' }),
        NOW,
      );
      expect(dmca.holdForLitigation).toHaveBeenCalledWith(
        row(),
        { type: 'operator', id: 'op-1' },
        NOW,
      );
    });

    it('conflicts when the notice cannot be held', async () => {
      dmca.holdForLitigation.mockResolvedValue(null);
      await expect(
        service.decide(
          'notice-1',
          'op-1',
          decision({ decision: 'litigation_hold' }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is a 404 for an unknown notice', async () => {
      dmca.findNotice.mockResolvedValue(null);
      await expect(
        service.decide(
          'missing',
          'op-1',
          decision({ decision: 'reject' }),
          NOW,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
