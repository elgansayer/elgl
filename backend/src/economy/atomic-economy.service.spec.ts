import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { CentrifugoService } from '../chat/centrifugo.service';
import type { MetricsService } from '../metrics/metrics.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { UsersService } from '../users/users.service';
import { AtomicEconomyService } from './atomic-economy.service';

function createHarness() {
  const rpc = vi.fn();
  const redisDel = vi.fn().mockResolvedValue(1);
  const loggerError = vi.fn();
  const logger = {
    warn: vi.fn(),
    debug: vi.fn(),
    error: loggerError,
  } as unknown as PinoLogger;
  const supabaseService = {
    getClient: () => ({ rpc }),
    getRedisClient: () => ({ del: redisDel }),
  } as unknown as SupabaseService;
  const recordDailyCheckInClaim = vi.fn();
  const recordCoinPurchaseError = vi.fn();
  const observeCoinTransactionLatency = vi.fn();
  const metrics = {
    recordDailyCheckInClaim,
    recordCoinPurchaseError,
    observeCoinTransactionLatency,
  } as unknown as MetricsService;
  const config = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? 'test' : undefined)),
  } as unknown as ConfigService;

  const service = new AtomicEconomyService(
    logger,
    supabaseService,
    {} as unknown as UsersService,
    {} as unknown as CentrifugoService,
    config,
    {} as unknown as HttpService,
    metrics,
  );

  return {
    service,
    rpc,
    redisDel,
    loggerError,
    recordDailyCheckInClaim,
    recordCoinPurchaseError,
    observeCoinTransactionLatency,
  };
}

describe('AtomicEconomyService daily check-in', () => {
  it('returns the database-authoritative reward and invalidates the balance-dependent cache', async () => {
    const { service, rpc, redisDel, recordDailyCheckInClaim } = createHarness();
    rpc.mockResolvedValue({
      data: [{ claimed: true, coins_rewarded: 8, new_balance: 58 }],
      error: null,
    });

    await expect(service.claimDailyCheckIn('user-1')).resolves.toEqual({
      claimed: true,
      coins_rewarded: 8,
      new_balance: 58,
    });

    expect(rpc).toHaveBeenCalledWith('claim_daily_checkin', {
      p_user_id: 'user-1',
    });
    expect(redisDel).toHaveBeenCalledWith('economy:sticker_packs:user-1');
    expect(recordDailyCheckInClaim).toHaveBeenCalledWith(true);
  });

  it('returns an idempotent repeated-claim result without invalidating caches', async () => {
    const { service, rpc, redisDel, recordDailyCheckInClaim } = createHarness();
    rpc.mockResolvedValue({
      data: [{ claimed: false, coins_rewarded: 0, new_balance: 91 }],
      error: null,
    });

    await expect(service.claimDailyCheckIn('user-1')).resolves.toEqual({
      claimed: false,
      coins_rewarded: 0,
      new_balance: 91,
    });

    expect(redisDel).not.toHaveBeenCalled();
    expect(recordDailyCheckInClaim).toHaveBeenCalledWith(false);
  });

  it('fails closed when the database claim fails', async () => {
    const { service, rpc, loggerError, recordCoinPurchaseError } =
      createHarness();
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'provider detail' },
    });

    await expect(service.claimDailyCheckIn('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(recordCoinPurchaseError).toHaveBeenCalledWith(
      'daily_checkin',
      'atomic_claim',
    );
    expect(loggerError).toHaveBeenCalledWith('Daily check-in claim failed');
    expect(loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('user-1'),
    );
    expect(loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('provider detail'),
    );
  });

  it.each([
    [{ claimed: true, coins_rewarded: 4, new_balance: 54 }],
    [{ claimed: false, coins_rewarded: 6, new_balance: 54 }],
    [{ claimed: true, coins_rewarded: 7, new_balance: -1 }],
    [],
  ])('rejects malformed RPC results: %j', async (data) => {
    const { service, rpc } = createHarness();
    rpc.mockResolvedValue({ data, error: null });

    await expect(service.claimDailyCheckIn('user-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('always records claim latency on success and failure', async () => {
    const success = createHarness();
    success.rpc.mockResolvedValue({
      data: [{ claimed: true, coins_rewarded: 5, new_balance: 55 }],
      error: null,
    });
    await success.service.claimDailyCheckIn('user-1');
    expect(success.observeCoinTransactionLatency).toHaveBeenCalledWith(
      'daily_checkin',
      expect.any(Number),
    );

    const failure = createHarness();
    failure.rpc.mockRejectedValue(new Error('network down'));
    await expect(
      failure.service.claimDailyCheckIn('user-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(failure.observeCoinTransactionLatency).toHaveBeenCalledWith(
      'daily_checkin',
      expect.any(Number),
    );
  });
});
