import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AgeGateStatusService } from './age-gate-status.service';
import { AgeGateService } from './age-gate.service';
import {
  AGE_GATE_BAN_DURATION,
  AGE_GATE_ERROR_CODES,
  AGE_GATE_LOCKOUT_HOURS,
  AgeGateStatus,
} from './age-gate.constants';
import { hashLockoutIdentifier } from './age-gate-policy';

type QueryResult = { data: unknown; error: { message: string } | null };

interface RecordedQuery {
  table: string;
  calls: Array<{ method: string; args: unknown[] }>;
}

const OK: QueryResult = { data: null, error: null };
const SECRET = 'service-role-secret-for-tests';
const NOW = new Date('2026-11-11T10:00:00.000Z');

describe('AgeGateService', () => {
  let queued: Record<string, QueryResult[]>;
  let recorded: RecordedQuery[];
  let currentStatus: AgeGateStatus;
  let getStatus: ReturnType<typeof vi.fn>;
  let invalidate: ReturnType<typeof vi.fn>;
  let invalidateUserCaches: ReturnType<typeof vi.fn>;
  let recordAgeGateDecision: ReturnType<typeof vi.fn>;
  let updateUserById: ReturnType<typeof vi.fn>;
  let deleteUser: ReturnType<typeof vi.fn>;
  let service: AgeGateService;

  /** Chainable, awaitable stand-in for the Supabase query builder. */
  function createQuery(table: string, result: QueryResult) {
    const record: RecordedQuery = { table, calls: [] };
    recorded.push(record);
    const query: Record<string, unknown> = {};
    for (const method of [
      'select',
      'update',
      'insert',
      'upsert',
      'delete',
      'eq',
      'in',
      'gt',
      'lt',
      'or',
      'order',
      'limit',
    ]) {
      query[method] = vi.fn((...args: unknown[]) => {
        record.calls.push({ method, args });
        return query;
      });
    }
    query.maybeSingle = vi.fn(() => {
      record.calls.push({ method: 'maybeSingle', args: [] });
      return Promise.resolve(result);
    });
    query.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return query;
  }

  const queue = (table: string, ...results: QueryResult[]) => {
    queued[table] = [...(queued[table] ?? []), ...results];
  };

  const queriesFor = (table: string) =>
    recorded.filter((entry) => entry.table === table);

  const payloadOf = (entry: RecordedQuery | undefined, method: string) =>
    entry?.calls.find((call) => call.method === method)?.args[0];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    queued = {};
    recorded = [];
    currentStatus = 'required';
    getStatus = vi.fn(() => Promise.resolve(currentStatus));
    invalidate = vi.fn();
    invalidateUserCaches = vi.fn().mockResolvedValue(undefined);
    recordAgeGateDecision = vi.fn();
    updateUserById = vi.fn().mockResolvedValue({ error: null });
    deleteUser = vi.fn().mockResolvedValue({ error: null });

    const client = {
      from: vi.fn((table: string) =>
        createQuery(table, queued[table]?.shift() ?? OK),
      ),
      auth: { admin: { updateUserById, deleteUser } },
    };

    const statusService = {
      getStatus,
      invalidate,
      decide: (status: AgeGateStatus) =>
        new AgeGateStatusService({
          getClient: () => client,
        } as unknown as SupabaseService).decide(status, NOW),
    } as unknown as AgeGateStatusService;

    service = new AgeGateService(
      { getClient: () => client } as unknown as SupabaseService,
      statusService,
      {
        get: (key: string) =>
          key === 'SUPABASE_SERVICE_ROLE_KEY' ? SECRET : undefined,
      } as unknown as ConfigService,
      { invalidateUserCaches } as unknown as SafetyCacheInvalidationService,
      { recordAgeGateDecision } as unknown as MetricsService,
    );
  });

  describe('getStatus', () => {
    it.each([
      ['required', { status: 'required', required: true, blocked: false }],
      ['legacy', { status: 'legacy', required: false, blocked: false }],
      ['passed', { status: 'passed', required: false, blocked: false }],
      [
        'blocked_under_age',
        { status: 'blocked_under_age', required: false, blocked: true },
      ],
    ] as const)(
      'describes %s accounts without exposing the threshold',
      async (status, view) => {
        currentStatus = status;
        await expect(service.getStatus('user-1', NOW)).resolves.toEqual(view);
      },
    );
  });

  describe('submitDateOfBirth', () => {
    it.each(['2026-12-01', '1800-01-01', 'garbage', '2013-02-30'])(
      'rejects %j before touching the database',
      async (dateOfBirth) => {
        const attempt = service.submitDateOfBirth(
          { id: 'user-1', email: 'a@example.com' },
          { dateOfBirth },
          NOW,
        );

        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toMatchObject({
          response: { code: AGE_GATE_ERROR_CODES.invalidDateOfBirth },
        });
        expect(recorded).toHaveLength(0);
        expect(getStatus).not.toHaveBeenCalled();
      },
    );

    describe('eligible declaration', () => {
      it('stores the date and a derived age, then marks the account passed', async () => {
        queue('users', OK, { data: [{ id: 'user-1' }], error: null });

        const view = await service.submitDateOfBirth(
          { id: 'user-1', email: 'adult@example.com' },
          { dateOfBirth: '1990-05-17' },
          NOW,
        );

        expect(view).toEqual({
          status: 'passed',
          required: false,
          blocked: false,
        });

        const [ensureRow, markPassed] = queriesFor('users');
        expect(payloadOf(ensureRow, 'upsert')).toEqual({ id: 'user-1' });
        expect(
          ensureRow?.calls.find((c) => c.method === 'upsert')?.args[1],
        ).toEqual({
          onConflict: 'id',
          ignoreDuplicates: true,
        });
        expect(payloadOf(markPassed, 'update')).toEqual({
          date_of_birth: '1990-05-17',
          age: 36,
          age_gate_status: 'passed',
          age_gate_completed_at: NOW.toISOString(),
        });
        // Compare-and-set: a concurrent winner cannot be overwritten.
        expect(markPassed?.calls).toContainEqual({
          method: 'in',
          args: ['age_gate_status', ['legacy', 'required']],
        });
        expect(invalidate).toHaveBeenCalledWith('user-1');
        expect(recordAgeGateDecision).toHaveBeenCalledWith('passed');
        expect(payloadOf(queriesFor('age_gate_events')[0], 'insert')).toEqual({
          subject_id: 'user-1',
          outcome: 'passed',
          minimum_age: 13,
        });
        expect(updateUserById).not.toHaveBeenCalled();
      });

      it('accepts a user whose 13th birthday is today', async () => {
        queue('users', OK, { data: [{ id: 'user-1' }], error: null });

        const view = await service.submitDateOfBirth(
          { id: 'user-1' },
          { dateOfBirth: '2013-11-11' },
          NOW,
        );

        expect(view.status).toBe('passed');
      });

      it('lets a grandfathered legacy account complete the gate', async () => {
        currentStatus = 'legacy';
        queue('users', OK, { data: [{ id: 'user-1' }], error: null });

        const view = await service.submitDateOfBirth(
          { id: 'user-1' },
          { dateOfBirth: '1985-01-01' },
          NOW,
        );

        expect(view.status).toBe('passed');
      });

      it('reports the winner when a concurrent request completed the gate first', async () => {
        queue('users', OK, { data: [], error: null });
        getStatus
          .mockResolvedValueOnce('required')
          .mockResolvedValueOnce('passed');

        const view = await service.submitDateOfBirth(
          { id: 'user-1' },
          { dateOfBirth: '1990-05-17' },
          NOW,
        );

        expect(view.status).toBe('passed');
        expect(queriesFor('age_gate_events')).toHaveLength(0);
        expect(recordAgeGateDecision).not.toHaveBeenCalled();
      });

      it('returns 503 and records nothing when the write fails', async () => {
        queue('users', OK, { data: null, error: { message: 'boom' } });

        await expect(
          service.submitDateOfBirth(
            { id: 'user-1' },
            { dateOfBirth: '1990-05-17' },
            NOW,
          ),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(recordAgeGateDecision).not.toHaveBeenCalled();
      });
    });

    describe('under-age declaration', () => {
      const childDate = '2018-03-04';

      async function declareChild() {
        queue('users', OK, { data: [{ id: 'child-1' }], error: null });
        return service.submitDateOfBirth(
          { id: 'child-1', email: 'Child@Example.com' },
          { dateOfBirth: childDate },
          NOW,
        );
      }

      it('blocks the account, drops the date and age, and requests immediate erasure in one write', async () => {
        const view = await declareChild();

        expect(view).toEqual({
          status: 'blocked_under_age',
          required: false,
          blocked: true,
        });

        const blockWrite = queriesFor('users')[1];
        expect(payloadOf(blockWrite, 'update')).toEqual({
          age_gate_status: 'blocked_under_age',
          age_gate_completed_at: NOW.toISOString(),
          date_of_birth: null,
          age: null,
          is_deletion_pending: true,
          deletion_requested_at: NOW.toISOString(),
          scheduled_for_deletion_at: NOW.toISOString(),
          privacy_hide_from_search: true,
          location: null,
          mock_location: null,
          mock_country: null,
          mock_city: null,
        });
        expect(blockWrite?.calls).toContainEqual({
          method: 'in',
          args: ['age_gate_status', ['legacy', 'required']],
        });
      });

      it('never persists, logs or returns the declared date', async () => {
        const view = await declareChild();

        const everything = JSON.stringify({
          recorded,
          view,
          updateUserById: updateUserById.mock.calls,
          logs: [
            ...vi.mocked(Logger.prototype.log).mock.calls,
            ...vi.mocked(Logger.prototype.error).mock.calls,
          ],
        });
        expect(everything).not.toContain(childDate);
        expect(everything).not.toContain('2018');
      });

      it('locks out only a keyed hash of the mailbox for the configured window', async () => {
        await declareChild();

        const [lockout] = queriesFor('age_gate_lockouts').filter((q) =>
          q.calls.some((c) => c.method === 'upsert'),
        );
        const row = payloadOf(lockout, 'upsert') as {
          identifier_hash: string;
          locked_until: string;
        };

        expect(row.identifier_hash).toBe(
          hashLockoutIdentifier('child@example.com', SECRET),
        );
        expect(JSON.stringify(recorded)).not.toContain('child@example.com');
        expect(new Date(row.locked_until).getTime()).toBe(
          NOW.getTime() + AGE_GATE_LOCKOUT_HOURS * 60 * 60 * 1000,
        );
      });

      it('bans sign-in, clears user caches and counts the decision', async () => {
        await declareChild();

        expect(updateUserById).toHaveBeenCalledWith('child-1', {
          ban_duration: AGE_GATE_BAN_DURATION,
        });
        expect(invalidateUserCaches).toHaveBeenCalledWith('child-1');
        expect(invalidate).toHaveBeenCalledWith('child-1');
        expect(recordAgeGateDecision).toHaveBeenCalledWith('blocked_under_age');
        expect(payloadOf(queriesFor('age_gate_events')[0], 'insert')).toEqual({
          subject_id: 'child-1',
          outcome: 'blocked_under_age',
          minimum_age: 13,
        });
      });

      it('still blocks when the sign-in ban call fails, because the status check enforces access', async () => {
        updateUserById.mockRejectedValue(new Error('auth down'));

        await expect(declareChild()).resolves.toMatchObject({
          status: 'blocked_under_age',
        });
      });

      it('skips the lockout when the account has no email address', async () => {
        queue('users', OK, { data: [{ id: 'child-1' }], error: null });

        await service.submitDateOfBirth(
          { id: 'child-1' },
          { dateOfBirth: childDate },
          NOW,
        );

        expect(queriesFor('age_gate_lockouts')).toHaveLength(0);
      });
    });

    describe('first declaration wins', () => {
      it('does not let a passed account change its date', async () => {
        currentStatus = 'passed';

        const view = await service.submitDateOfBirth(
          { id: 'user-1' },
          { dateOfBirth: '2018-03-04' },
          NOW,
        );

        expect(view.status).toBe('passed');
        expect(recorded).toHaveLength(0);
      });

      it('does not let a blocked account retry with an older date', async () => {
        currentStatus = 'blocked_under_age';

        const view = await service.submitDateOfBirth(
          { id: 'child-1', email: 'child@example.com' },
          { dateOfBirth: '1990-01-01' },
          NOW,
        );

        expect(view).toMatchObject({
          status: 'blocked_under_age',
          blocked: true,
        });
        expect(recorded).toHaveLength(0);
      });
    });

    describe('lockout', () => {
      it('blocks a mailbox that declared an under-age date recently, even with an eligible date now', async () => {
        queue('age_gate_lockouts', {
          data: { locked_until: '2026-11-15T00:00:00.000Z' },
          error: null,
        });
        queue('users', OK, { data: [{ id: 'user-2' }], error: null });

        const view = await service.submitDateOfBirth(
          { id: 'user-2', email: 'child@example.com' },
          { dateOfBirth: '1990-01-01' },
          NOW,
        );

        expect(view.status).toBe('blocked_under_age');
        const blockWrite = queriesFor('users')[1];
        expect(payloadOf(blockWrite, 'update')).toMatchObject({
          date_of_birth: null,
          age_gate_status: 'blocked_under_age',
        });
        expect(
          payloadOf(queriesFor('age_gate_events')[0], 'insert'),
        ).toMatchObject({
          outcome: 'lockout_blocked',
        });
        expect(recordAgeGateDecision).toHaveBeenCalledWith('lockout_blocked');
      });

      it('only considers lockouts that have not expired', async () => {
        queue('users', OK, { data: [{ id: 'user-2' }], error: null });

        await service.submitDateOfBirth(
          { id: 'user-2', email: 'someone@example.com' },
          { dateOfBirth: '1990-01-01' },
          NOW,
        );

        const lookup = queriesFor('age_gate_lockouts')[0];
        expect(lookup?.calls).toContainEqual({
          method: 'gt',
          args: ['locked_until', NOW.toISOString()],
        });
      });

      it('refuses to guess when the lockout table cannot be read', async () => {
        queue('age_gate_lockouts', { data: null, error: { message: 'down' } });

        await expect(
          service.submitDateOfBirth(
            { id: 'user-2', email: 'someone@example.com' },
            { dateOfBirth: '1990-01-01' },
            NOW,
          ),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
      });
    });
  });

  describe('maintenance', () => {
    it('schedules immediate erasure for a blocked account that has none', async () => {
      queue('users', {
        data: [
          {
            id: 'child-1',
            is_deletion_pending: false,
            scheduled_for_deletion_at: null,
          },
        ],
        error: null,
      });

      await expect(
        service.scheduleErasureForBlockedAccounts(NOW),
      ).resolves.toBe(1);

      const [page, schedule] = queriesFor('users');
      expect(page?.calls).toContainEqual({
        method: 'eq',
        args: ['age_gate_status', 'blocked_under_age'],
      });
      expect(page?.calls).toContainEqual({
        method: 'or',
        args: [
          `is_deletion_pending.eq.false,scheduled_for_deletion_at.gt.${NOW.toISOString()}`,
        ],
      });
      expect(payloadOf(schedule, 'update')).toMatchObject({
        is_deletion_pending: true,
        scheduled_for_deletion_at: NOW.toISOString(),
        privacy_hide_from_search: true,
        age: null,
      });
      expect(
        payloadOf(queriesFor('age_gate_events')[0], 'insert'),
      ).toMatchObject({
        subject_id: 'child-1',
        outcome: 'erasure_scheduled',
      });
    });

    it('pulls a 30-day deletion forward by clearing the pending flag first', async () => {
      queue('users', {
        data: [
          {
            id: 'child-1',
            is_deletion_pending: true,
            scheduled_for_deletion_at: '2026-12-01T00:00:00.000Z',
          },
        ],
        error: null,
      });

      await service.scheduleErasureForBlockedAccounts(NOW);

      const [, clear, schedule] = queriesFor('users');
      expect(payloadOf(clear, 'update')).toEqual({
        is_deletion_pending: false,
      });
      expect(payloadOf(schedule, 'update')).toMatchObject({
        is_deletion_pending: true,
        scheduled_for_deletion_at: NOW.toISOString(),
      });
    });

    it('does nothing when no blocked account needs scheduling', async () => {
      queue('users', { data: [], error: null });
      await expect(
        service.scheduleErasureForBlockedAccounts(NOW),
      ).resolves.toBe(0);
      expect(queriesFor('age_gate_events')).toHaveLength(0);
    });

    it('skips an account whose write failed and keeps going', async () => {
      queue(
        'users',
        {
          data: [
            {
              id: 'a',
              is_deletion_pending: false,
              scheduled_for_deletion_at: null,
            },
            {
              id: 'b',
              is_deletion_pending: false,
              scheduled_for_deletion_at: null,
            },
          ],
          error: null,
        },
        { data: null, error: { message: 'nope' } },
        OK,
      );

      await expect(
        service.scheduleErasureForBlockedAccounts(NOW),
      ).resolves.toBe(1);
    });

    it('removes the sign-in identity of erased blocked accounts and reports only counts', async () => {
      queue('users', {
        data: [{ id: 'child-1' }, { id: 'child-2' }],
        error: null,
      });
      deleteUser.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({
        error: { message: 'FK violation child-2@example.com' },
      });

      await expect(service.purgeErasedIdentities()).resolves.toBe(1);

      expect(deleteUser).toHaveBeenCalledWith('child-1');
      expect(deleteUser).toHaveBeenCalledWith('child-2');
      expect(
        payloadOf(queriesFor('age_gate_events')[0], 'insert'),
      ).toMatchObject({
        subject_id: 'child-1',
        outcome: 'identity_purged',
      });
      const logged = JSON.stringify([
        ...vi.mocked(Logger.prototype.error).mock.calls,
        ...vi.mocked(Logger.prototype.log).mock.calls,
      ]);
      expect(logged).toContain('age_gate_identity_purge_failed count=1');
      expect(logged).not.toContain('example.com');
      expect(logged).not.toContain('child-2');
    });

    it('purges expired lockouts and events older than the retention period', async () => {
      await service.purgeExpiredRecords(NOW);

      const lockoutDelete = queriesFor('age_gate_lockouts')[0];
      expect(lockoutDelete?.calls).toContainEqual({
        method: 'lt',
        args: ['locked_until', NOW.toISOString()],
      });
      const eventDelete = queriesFor('age_gate_events')[0];
      expect(eventDelete?.calls).toContainEqual({
        method: 'lt',
        args: ['created_at', '2024-11-11T10:00:00.000Z'],
      });
    });

    it('fails loudly when retention cannot be applied', async () => {
      queue('age_gate_events', { data: null, error: { message: 'locked' } });
      await expect(service.purgeExpiredRecords(NOW)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('runs every maintenance step even when an earlier one fails', async () => {
      queue('users', { data: null, error: { message: 'down' } });

      await expect(service.runMaintenance(NOW)).resolves.toBeUndefined();

      expect(queriesFor('age_gate_lockouts').length).toBeGreaterThan(0);
      expect(vi.mocked(Logger.prototype.error)).toHaveBeenCalledWith(
        'age_gate_maintenance_step_failed step=schedule_erasure',
      );
    });
  });
});
