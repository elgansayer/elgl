import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AgeGateStatusService } from './age-gate-status.service';
import {
  AGE_GATE_ERROR_CODES,
  AGE_GATE_STATUS_CACHE_MAX_ENTRIES,
  AGE_GATE_STATUS_CACHE_TTL_MS,
} from './age-gate.constants';

describe('AgeGateStatusService', () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let enforcementFrom: string | undefined;
  let service: AgeGateStatusService;

  const now = new Date('2026-11-11T10:00:00.000Z');

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    enforcementFrom = undefined;

    const query = { select, eq, maybeSingle };
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    from.mockReturnValue(query);

    service = new AgeGateStatusService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      {
        get: (key: string) =>
          key === 'AGE_GATE_LEGACY_ENFORCEMENT_FROM'
            ? enforcementFrom
            : undefined,
      } as unknown as ConfigService,
    );
  });

  const statusIs = (status: unknown) =>
    maybeSingle.mockResolvedValue({
      data: status === undefined ? null : { age_gate_status: status },
      error: null,
    });

  describe('getStatus', () => {
    it('reads only the status column for the account', async () => {
      statusIs('passed');

      await expect(service.getStatus('user-1')).resolves.toBe('passed');
      expect(from).toHaveBeenCalledWith('users');
      expect(select).toHaveBeenCalledWith('age_gate_status');
      expect(eq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('fails closed when the profile row does not exist yet', async () => {
      statusIs(undefined);
      await expect(service.getStatus('user-1')).resolves.toBe('required');
    });

    it('fails closed on an unknown stored value', async () => {
      statusIs('verified-by-someone');
      await expect(service.getStatus('user-1')).resolves.toBe('required');
    });

    it('reports a database failure as unavailable without leaking the cause', async () => {
      const errorLog = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'relation users secret detail' },
      });

      await expect(service.getStatus('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(errorLog).toHaveBeenCalledWith('age_gate_status_lookup_failed');
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain('secret');
    });
  });

  describe('decide', () => {
    it('allows passed accounts', () => {
      expect(service.decide('passed', now)).toEqual({ allowed: true });
    });

    it('requires a declaration from new accounts', () => {
      expect(service.decide('required', now)).toEqual({
        allowed: false,
        code: AGE_GATE_ERROR_CODES.required,
      });
    });

    it('permanently blocks under-age accounts', () => {
      expect(service.decide('blocked_under_age', now)).toEqual({
        allowed: false,
        code: AGE_GATE_ERROR_CODES.blocked,
      });
    });

    it('grandfathers legacy accounts until an enforcement date is configured', () => {
      expect(service.decide('legacy', now)).toEqual({ allowed: true });
    });

    it('keeps legacy accounts allowed before the enforcement date and requires them afterwards', () => {
      enforcementFrom = '2026-12-01T00:00:00.000Z';
      expect(service.decide('legacy', now)).toEqual({ allowed: true });

      expect(
        service.decide('legacy', new Date('2026-12-01T00:00:00.000Z')),
      ).toEqual({
        allowed: false,
        code: AGE_GATE_ERROR_CODES.required,
      });
    });

    it('fails closed when the configured enforcement date is unreadable', () => {
      const errorLog = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      enforcementFrom = 'next tuesday';

      expect(service.decide('legacy', now)).toEqual({
        allowed: false,
        code: AGE_GATE_ERROR_CODES.required,
      });
      service.decide('legacy', now);
      expect(errorLog).toHaveBeenCalledTimes(1);
    });

    it('treats a blank enforcement date as unset', () => {
      enforcementFrom = '   ';
      expect(service.legacyEnforcementStart()).toBeNull();
    });
  });

  describe('evaluate', () => {
    it('caches only passed accounts, and only for a short time', async () => {
      statusIs('passed');

      await service.evaluate('user-1', now);
      await service.evaluate('user-1', new Date(now.getTime() + 1_000));
      expect(maybeSingle).toHaveBeenCalledTimes(1);

      await service.evaluate(
        'user-1',
        new Date(now.getTime() + AGE_GATE_STATUS_CACHE_TTL_MS + 1),
      );
      expect(maybeSingle).toHaveBeenCalledTimes(2);
    });

    it('re-reads accounts that are not passed so a fresh declaration is seen at once', async () => {
      statusIs('required');
      await expect(service.evaluate('user-1', now)).resolves.toMatchObject({
        allowed: false,
      });

      statusIs('passed');
      await expect(service.evaluate('user-1', now)).resolves.toEqual({
        allowed: true,
      });
      expect(maybeSingle).toHaveBeenCalledTimes(2);
    });

    it('drops cached state when the account changes on this instance', async () => {
      statusIs('passed');
      await service.evaluate('user-1', now);

      service.invalidate('user-1');
      statusIs('blocked_under_age');

      await expect(service.evaluate('user-1', now)).resolves.toEqual({
        allowed: false,
        code: AGE_GATE_ERROR_CODES.blocked,
      });
    });

    it('bounds the cache so an attacker cannot grow memory without limit', async () => {
      statusIs('passed');
      for (let i = 0; i < AGE_GATE_STATUS_CACHE_MAX_ENTRIES + 5; i += 1) {
        await service.evaluate(`user-${i}`, now);
      }
      maybeSingle.mockClear();

      // The oldest entries were evicted and are read again; recent ones are not.
      await service.evaluate('user-0', now);
      expect(maybeSingle).toHaveBeenCalledTimes(1);
      await service.evaluate(
        `user-${AGE_GATE_STATUS_CACHE_MAX_ENTRIES + 4}`,
        now,
      );
      expect(maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('propagates an unavailable database instead of guessing', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      maybeSingle.mockResolvedValue({ data: null, error: { message: 'down' } });

      await expect(service.evaluate('user-1', now)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
