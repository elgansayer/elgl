import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { CentrifugoService } from '../chat/centrifugo.service';
import type { MetricsService } from '../metrics/metrics.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { UsersService } from '../users/users.service';
import { AtomicEconomyService } from './atomic-economy.service';

function buildService() {
  const rpc = vi.fn();
  const redisDel = vi.fn(() => Promise.resolve(1));
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as PinoLogger;
  const supabase = {
    getClient: vi.fn(() => ({ rpc })),
    getRedisClient: vi.fn(() => ({ del: redisDel })),
  } as unknown as SupabaseService;
  const users = {} as UsersService;
  const centrifugo = {} as CentrifugoService;
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
      if (key === 'NODE_ENV') return 'test';
      return null;
    }),
  } as unknown as ConfigService;
  const http = {} as HttpService;
  const metrics = {
    recordDailyCheckInClaim: vi.fn(),
    recordCoinPurchaseError: vi.fn(),
    observeCoinTransactionLatency: vi.fn(),
  } as unknown as MetricsService;

  return {
    service: new AtomicEconomyService(
      logger,
      supabase,
      users,
      centrifugo,
      config,
      http,
      metrics,
    ),
    rpc,
    logger,
    metrics,
    supabase,
    redisDel,
  };
}

describe('AtomicEconomyService daily check-in', () => {
  it('returns the authoritative atomic claim and chooses a reward between 5 and 10', async () => {
    const { service, rpc, metrics, redisDel } = buildService();
    rpc.mockImplementation(
      (_name: string, params: { p_reward: number }) =>
        Promise.resolve({
          data: [
            {
              claimed: true,
              coins_rewarded: params.p_reward,
              new_balance: 57,
            },
          ],
          error: null,
        }),
    );

    const result = await service.claimDailyCheckIn('user-1');

    expect(result.claimed).toBe(true);
    expect(result.coins_rewarded).toBeGreaterThanOrEqual(5);
    expect(result.coins_rewarded).toBeLessThanOrEqual(10);
    expect(result.new_balance).toBe(57);
    expect(rpc).toHaveBeenCalledWith(
      'claim_daily_checkin_reward',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_reward: expect.any(Number),
      }),
    );
    expect(metrics.recordDailyCheckInClaim).toHaveBeenCalledWith(true);
    expect(redisDel).toHaveBeenCalledWith('economy:sticker_packs:user-1');
  });

  it('treats a repeated UTC-day claim as an idempotent no-op', async () => {
    const { service, rpc, metrics } = buildService();
    rpc.mockResolvedValue({
      data: [{ claimed: false, coins_rewarded: 0, new_balance: 91 }],
      error: null,
    });

    await expect(service.claimDailyCheckIn('user-1')).resolves.toEqual({
      claimed: false,
      coins_rewarded: 0,
      new_balance: 91,
    });
    expect(metrics.recordDailyCheckInClaim).toHaveBeenCalledWith(false);
  });

  it('fails closed when the RPC is unavailable without fabricating a balance', async () => {
    const { service, rpc, logger, metrics } = buildService();
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'provider details must not escape' },
    });

    await expect(service.claimDailyCheckIn('user-1')).resolves.toEqual({
      claimed: false,
      coins_rewarded: 0,
      new_balance: 0,
      unavailable: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Daily check-in reward is temporarily unavailable',
    );
    expect(metrics.recordCoinPurchaseError).toHaveBeenCalledWith(
      'daily_checkin',
      'atomic_rpc_unavailable',
    );
  });

  it.each([
    null,
    [],
    [{ claimed: true, coins_rewarded: 11, new_balance: 61 }],
    [{ claimed: false, coins_rewarded: 5, new_balance: 61 }],
    [{ claimed: true, coins_rewarded: 5, new_balance: -1 }],
  ])('rejects malformed provider output: %j', async (data) => {
    const { service, rpc } = buildService();
    rpc.mockResolvedValue({ data, error: null });

    await expect(service.claimDailyCheckIn('user-1')).resolves.toEqual(
      expect.objectContaining({
        claimed: false,
        coins_rewarded: 0,
        unavailable: true,
      }),
    );
  });

  it('relies on the database idempotency contract for concurrent requests', async () => {
    const { service, rpc } = buildService();
    rpc
      .mockResolvedValueOnce({
        data: [{ claimed: true, coins_rewarded: 7, new_balance: 107 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ claimed: false, coins_rewarded: 0, new_balance: 107 }],
        error: null,
      });

    const results = await Promise.all([
      service.claimDailyCheckIn('user-1'),
      service.claimDailyCheckIn('user-1'),
    ]);

    expect(results.filter((result) => result.claimed)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
