import { ServiceUnavailableException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { CoinEconomyHealthService } from './coin-economy-health.service';
import { AtomicEconomyController } from './atomic-economy.controller';
import type { EconomyService } from './economy.service';

function buildController() {
  const claimDailyCheckIn = vi.fn();
  const economyService = {
    claimDailyCheckIn,
  } as unknown as EconomyService;
  const healthService = {} as CoinEconomyHealthService;

  return {
    controller: new AtomicEconomyController(economyService, healthService),
    claimDailyCheckIn,
  };
}

describe('AtomicEconomyController daily check-in', () => {
  it('does not claim a reward without an authenticated user', async () => {
    const { controller, claimDailyCheckIn } = buildController();

    await expect(controller.claimDailyCheckIn(null)).resolves.toBeNull();
    expect(claimDailyCheckIn).not.toHaveBeenCalled();
  });

  it('returns the authoritative claim result', async () => {
    const { controller, claimDailyCheckIn } = buildController();
    claimDailyCheckIn.mockResolvedValue({
      claimed: true,
      coins_rewarded: 7,
      new_balance: 107,
    });

    await expect(
      controller.claimDailyCheckIn({ id: 'user-1' } as User),
    ).resolves.toEqual({
      claimed: true,
      coins_rewarded: 7,
      new_balance: 107,
    });
    expect(claimDailyCheckIn).toHaveBeenCalledWith('user-1');
  });

  it('reports provider degradation as HTTP 503 instead of a fabricated reward', async () => {
    const { controller, claimDailyCheckIn } = buildController();
    claimDailyCheckIn.mockResolvedValue({
      claimed: false,
      coins_rewarded: 0,
      new_balance: 0,
      unavailable: true,
    });

    await expect(
      controller.claimDailyCheckIn({ id: 'user-1' } as User),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
