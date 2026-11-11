import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  MAX_SUSPENSION_DAYS,
  SUSPENSION_CACHE_MAX_ENTRIES,
  SUSPENSION_CACHE_TTL_MS,
} from './account-suspension.constants';
import { AccountSuspensionService } from './account-suspension.service';

interface QueryResult {
  data?: unknown;
  error?: unknown;
}

/** Chainable, awaitable stand-in for a PostgREST query builder. */
function query(result: QueryResult) {
  const settled = { data: null, error: null, ...result };
  const builder: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'eq',
    'is',
    'gt',
    'in',
    'order',
    'limit',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(settled));
  builder.maybeSingle = vi.fn(() => Promise.resolve(settled));
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(settled).then(resolve);
  return builder;
}

const USER = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const KEY = '33333333-3333-4333-8333-333333333333';
const SUSPENSION_ID = '44444444-4444-4444-8444-444444444444';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: SUSPENSION_ID,
    user_id: USER,
    reason_code: 'policy_violation',
    report_id: null,
    issued_by: ACTOR,
    idempotency_key: KEY,
    created_at: '2026-11-09T10:00:00.000Z',
    expires_at: '2026-11-16T10:00:00.000Z',
    lifted_at: null,
    lifted_by: null,
    lift_reason_code: null,
    ...overrides,
  };
}

describe('AccountSuspensionService', () => {
  let service: AccountSuspensionService;
  let queues: Record<string, Array<Record<string, unknown>>>;
  let from: ReturnType<typeof vi.fn>;
  let metrics: {
    recordAccountSuspensionAction: ReturnType<typeof vi.fn>;
    recordAccountSuspensionCheckFailure: ReturnType<typeof vi.fn>;
  };

  const enqueue = (table: string, result: QueryResult) => {
    const builder = query(result);
    (queues[table] ??= []).push(builder);
    return builder;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    queues = {};
    from = vi.fn((table: string) => {
      const next = queues[table]?.shift();
      if (!next) throw new Error(`unexpected query on ${table}`);
      return next;
    });
    metrics = {
      recordAccountSuspensionAction: vi.fn(),
      recordAccountSuspensionCheckFailure: vi.fn(),
    };
    service = new AccountSuspensionService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      metrics as unknown as MetricsService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findActive', () => {
    const active = {
      id: SUSPENSION_ID,
      expires_at: '2026-11-16T10:00:00.000Z',
    };

    it('returns the active suspension', async () => {
      enqueue('account_suspensions', { data: active });

      await expect(service.findActive(USER)).resolves.toEqual({
        id: SUSPENSION_ID,
        expiresAt: '2026-11-16T10:00:00.000Z',
      });
    });

    it('returns null when nothing is active', async () => {
      enqueue('account_suspensions', { data: null });

      await expect(service.findActive(USER)).resolves.toBeNull();
    });

    it('serves repeat lookups from the cache within the TTL', async () => {
      enqueue('account_suspensions', { data: active });

      await service.findActive(USER);
      await service.findActive(USER);

      expect(from).toHaveBeenCalledTimes(1);
    });

    it('refreshes after the TTL so a lift on another instance is observed', async () => {
      enqueue('account_suspensions', { data: active });
      enqueue('account_suspensions', { data: null });

      await expect(service.findActive(USER)).resolves.not.toBeNull();
      vi.advanceTimersByTime(SUSPENSION_CACHE_TTL_MS + 1);

      await expect(service.findActive(USER)).resolves.toBeNull();
      expect(from).toHaveBeenCalledTimes(2);
    });

    it('stops reporting a cached suspension once it expires', async () => {
      enqueue('account_suspensions', {
        data: { id: SUSPENSION_ID, expires_at: '2026-11-09T10:00:10.000Z' },
      });

      await expect(service.findActive(USER)).resolves.not.toBeNull();
      vi.advanceTimersByTime(11_000);

      await expect(service.findActive(USER)).resolves.toBeNull();
    });

    it('coalesces concurrent lookups for the same user into one query', async () => {
      enqueue('account_suspensions', { data: active });

      const results = await Promise.all([
        service.findActive(USER),
        service.findActive(USER),
        service.findActive(USER),
      ]);

      expect(from).toHaveBeenCalledTimes(1);
      expect(results.every((value) => value?.id === SUSPENSION_ID)).toBe(true);
    });

    it('fails open, counts the failure and does not cache it', async () => {
      enqueue('account_suspensions', { error: { message: 'db down' } });
      enqueue('account_suspensions', { data: active });

      await expect(service.findActive(USER)).resolves.toBeNull();
      expect(metrics.recordAccountSuspensionCheckFailure).toHaveBeenCalledTimes(
        1,
      );

      await expect(service.findActive(USER)).resolves.not.toBeNull();
    });

    it('bounds the cache size', async () => {
      for (
        let index = 0;
        index < SUSPENSION_CACHE_MAX_ENTRIES + 5;
        index += 1
      ) {
        enqueue('account_suspensions', { data: null });
        await service.findActive(`user-${index}`);
      }

      // The oldest entries were evicted, so the first user is queried again.
      enqueue('account_suspensions', { data: null });
      await service.findActive('user-0');
      expect(from).toHaveBeenCalledTimes(SUSPENSION_CACHE_MAX_ENTRIES + 6);
    });
  });

  describe('issue', () => {
    const input = () => ({
      actorUserId: ACTOR,
      targetUserId: USER,
      reasonCode: 'policy_violation' as const,
      expiresAt: new Date('2026-11-16T10:00:00.000Z'),
      idempotencyKey: KEY,
    });

    it('records a suspension, returning an operator projection without notes', async () => {
      enqueue('account_suspensions', { data: null }); // replay lookup
      enqueue('users', { data: { id: USER } });
      const insert = enqueue('account_suspensions', { data: row() });

      const outcome = await service.issue({
        ...input(),
        operatorNote: 'private context',
        reportId: '55555555-5555-4555-8555-555555555555',
      });

      expect(outcome.replayed).toBe(false);
      expect(outcome.suspension).toEqual({
        id: SUSPENSION_ID,
        userId: USER,
        reasonCode: 'policy_violation',
        reportId: null,
        issuedBy: ACTOR,
        createdAt: '2026-11-09T10:00:00.000Z',
        expiresAt: '2026-11-16T10:00:00.000Z',
        liftedAt: null,
        liftedBy: null,
        liftReasonCode: null,
      });
      expect(insert.insert).toHaveBeenCalledWith({
        user_id: USER,
        reason_code: 'policy_violation',
        operator_note: 'private context',
        report_id: '55555555-5555-4555-8555-555555555555',
        issued_by: ACTOR,
        idempotency_key: KEY,
        expires_at: '2026-11-16T10:00:00.000Z',
      });
      expect(metrics.recordAccountSuspensionAction).toHaveBeenCalledWith(
        'issue',
        'success',
      );
    });

    it('takes effect immediately on this instance by dropping a cached "not suspended"', async () => {
      enqueue('account_suspensions', { data: null }); // cached negative
      await service.findActive(USER);

      enqueue('account_suspensions', { data: null });
      enqueue('users', { data: { id: USER } });
      enqueue('account_suspensions', { data: row() });
      await service.issue(input());

      enqueue('account_suspensions', {
        data: { id: SUSPENSION_ID, expires_at: '2026-11-16T10:00:00.000Z' },
      });
      await expect(service.findActive(USER)).resolves.not.toBeNull();
    });

    it('replays an identical retry without writing again', async () => {
      enqueue('account_suspensions', { data: row() });

      const outcome = await service.issue(input());

      expect(outcome.replayed).toBe(true);
      expect(from).toHaveBeenCalledTimes(1);
      expect(metrics.recordAccountSuspensionAction).toHaveBeenCalledWith(
        'issue',
        'replayed',
      );
    });

    it('rejects a key reused for a different user', async () => {
      enqueue('account_suspensions', {
        data: row({ user_id: '99999999-9999-4999-8999-999999999999' }),
      });

      await expect(service.issue(input())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(metrics.recordAccountSuspensionAction).toHaveBeenCalledWith(
        'issue',
        'conflict',
      );
    });

    it('resolves a unique-key race to the winning request', async () => {
      enqueue('account_suspensions', { data: null });
      enqueue('users', { data: { id: USER } });
      enqueue('account_suspensions', { error: { code: '23505' } });
      enqueue('account_suspensions', { data: row() });

      const outcome = await service.issue(input());

      expect(outcome.replayed).toBe(true);
    });

    it('rejects an unknown user', async () => {
      enqueue('account_suspensions', { data: null });
      enqueue('users', { data: null });

      await expect(service.issue(input())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a report that does not exist', async () => {
      enqueue('account_suspensions', { data: null });
      enqueue('users', { data: { id: USER } });
      enqueue('account_suspensions', { error: { code: '23503' } });

      await expect(
        service.issue({ ...input(), reportId: SUSPENSION_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['an expiry in the past', new Date('2026-11-09T09:00:00.000Z')],
      ['an expiry under a minute away', new Date('2026-11-09T10:00:30.000Z')],
      [
        'a suspension beyond the maximum',
        new Date(
          Date.parse('2026-11-09T10:00:00.000Z') +
            (MAX_SUSPENSION_DAYS + 1) * 86_400_000,
        ),
      ],
      ['an invalid date', new Date('not a date')],
    ])('rejects %s before touching storage', async (_label, expiresAt) => {
      await expect(
        service.issue({ ...input(), expiresAt }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(from).not.toHaveBeenCalled();
    });

    it('reports storage failures as unavailable, never as success', async () => {
      enqueue('account_suspensions', { data: null });
      enqueue('users', { data: { id: USER } });
      enqueue('account_suspensions', { error: { code: 'XX000' } });

      await expect(service.issue(input())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(metrics.recordAccountSuspensionAction).toHaveBeenCalledWith(
        'issue',
        'failure',
      );
    });
  });

  describe('lift', () => {
    const input = {
      actorUserId: ACTOR,
      suspensionId: SUSPENSION_ID,
      reasonCode: 'support_correction' as const,
    };

    it('lifts an active suspension with a conditional update', async () => {
      enqueue('account_suspensions', { data: row() });
      const update = enqueue('account_suspensions', {
        data: row({
          lifted_at: '2026-11-09T10:00:00.000Z',
          lifted_by: ACTOR,
          lift_reason_code: 'support_correction',
        }),
      });

      const outcome = await service.lift(input);

      expect(outcome.replayed).toBe(false);
      expect(outcome.suspension.liftedBy).toBe(ACTOR);
      expect(update.is).toHaveBeenCalledWith('lifted_at', null);
      expect(metrics.recordAccountSuspensionAction).toHaveBeenCalledWith(
        'lift',
        'success',
      );
    });

    it('treats an already lifted suspension as a replay', async () => {
      enqueue('account_suspensions', {
        data: row({
          lifted_at: '2026-11-09T09:00:00.000Z',
          lifted_by: ACTOR,
          lift_reason_code: 'support_correction',
        }),
      });

      const outcome = await service.lift(input);

      expect(outcome.replayed).toBe(true);
      expect(from).toHaveBeenCalledTimes(1);
    });

    it('settles a concurrent lift to the winning state', async () => {
      enqueue('account_suspensions', { data: row() });
      enqueue('account_suspensions', { data: null });
      enqueue('account_suspensions', {
        data: row({
          lifted_at: '2026-11-09T10:00:00.000Z',
          lifted_by: ACTOR,
          lift_reason_code: 'support_correction',
        }),
      });

      const outcome = await service.lift(input);

      expect(outcome.replayed).toBe(true);
    });

    it('returns not found for an unknown suspension', async () => {
      enqueue('account_suspensions', { data: null });

      await expect(service.lift(input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('frees the user at once on this instance', async () => {
      enqueue('account_suspensions', {
        data: { id: SUSPENSION_ID, expires_at: '2026-11-16T10:00:00.000Z' },
      });
      await expect(service.findActive(USER)).resolves.not.toBeNull();

      enqueue('account_suspensions', { data: row() });
      enqueue('account_suspensions', {
        data: row({
          lifted_at: '2026-11-09T10:00:00.000Z',
          lifted_by: ACTOR,
          lift_reason_code: 'support_correction',
        }),
      });
      await service.lift(input);

      enqueue('account_suspensions', { data: null });
      await expect(service.findActive(USER)).resolves.toBeNull();
    });

    it('reports storage failures as unavailable', async () => {
      enqueue('account_suspensions', { data: row() });
      enqueue('account_suspensions', { error: { code: 'XX000' } });

      await expect(service.lift(input)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('findActiveForUsers', () => {
    it('returns the longest active suspension per user in one query', async () => {
      enqueue('account_suspensions', {
        data: [
          { id: 'a', user_id: USER, expires_at: '2026-11-20T00:00:00.000Z' },
          { id: 'b', user_id: USER, expires_at: '2026-11-12T00:00:00.000Z' },
          { id: 'c', user_id: ACTOR, expires_at: '2026-11-13T00:00:00.000Z' },
        ],
      });

      const result = await service.findActiveForUsers([USER, ACTOR, USER]);

      expect(from).toHaveBeenCalledTimes(1);
      expect(result.get(USER)).toEqual({
        id: 'a',
        expiresAt: '2026-11-20T00:00:00.000Z',
      });
      expect(result.get(ACTOR)?.id).toBe('c');
    });

    it('does not query for an empty list', async () => {
      await expect(service.findActiveForUsers([])).resolves.toEqual(new Map());
      expect(from).not.toHaveBeenCalled();
    });
  });
});
