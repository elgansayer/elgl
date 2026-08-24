import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CentrifugoService } from '../chat/centrifugo.service';
import { withExponentialBackoff } from '../common/http-retry.helper';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { EconomyService } from './economy.service';

export interface DailyCheckInResult {
  claimed: boolean;
  coins_rewarded: number;
  new_balance: number;
  /**
   * True only when the authoritative database mutation could not be completed.
   * Older clients safely ignore this additive field and simply avoid showing
   * the reward modal because `claimed` is false.
   */
  unavailable?: boolean;
}

interface DailyCheckInRpcRow {
  claimed: boolean;
  coins_rewarded: number;
  new_balance: number;
}

function parseDailyCheckInRow(value: unknown): DailyCheckInRpcRow | null {
  const candidate = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : null
    : value;

  if (typeof candidate !== 'object' || candidate === null) return null;
  if (
    !('claimed' in candidate) ||
    !('coins_rewarded' in candidate) ||
    !('new_balance' in candidate)
  ) {
    return null;
  }

  const { claimed, coins_rewarded: reward, new_balance: balance } = candidate;
  if (
    typeof claimed !== 'boolean' ||
    typeof reward !== 'number' ||
    typeof balance !== 'number' ||
    !Number.isSafeInteger(reward) ||
    !Number.isSafeInteger(balance) ||
    balance < 0
  ) {
    return null;
  }

  if (claimed) {
    if (reward < 5 || reward > 10) return null;
  } else if (reward !== 0) {
    return null;
  }

  return {
    claimed,
    coins_rewarded: reward,
    new_balance: balance,
  };
}

/**
 * Production hardening for the daily-login reward path.
 *
 * The broader EconomyService remains the public DI token so existing callers
 * do not need a parallel abstraction. Only the legacy Redis/read-modify-write
 * daily check-in method is replaced here; every other economy method is
 * inherited unchanged.
 */
@Injectable()
export class AtomicEconomyService extends EconomyService {
  constructor(
    @InjectPinoLogger(EconomyService.name)
    private readonly dailyCheckInLogger: PinoLogger,
    private readonly dailyCheckInSupabase: SupabaseService,
    usersService: UsersService,
    centrifugoService: CentrifugoService,
    configService: ConfigService,
    httpService: HttpService,
    private readonly dailyCheckInMetrics: MetricsService,
  ) {
    super(
      dailyCheckInLogger,
      dailyCheckInSupabase,
      usersService,
      centrifugoService,
      configService,
      httpService,
      dailyCheckInMetrics,
    );
  }

  override async claimDailyCheckIn(userId: string): Promise<DailyCheckInResult> {
    const startedAt = Date.now();

    // The value is not security-sensitive, but using the platform CSPRNG keeps
    // reward selection unbiased and avoids predictable Math.random sequences.
    const reward = randomInt(5, 11);

    try {
      const client = this.dailyCheckInSupabase.getClient();
      const response = await withExponentialBackoff(
        () =>
          client.rpc('claim_daily_checkin_reward', {
            p_user_id: userId,
            p_reward: reward,
          }),
        'claimDailyCheckInAtomic',
        { logger: this.dailyCheckInLogger },
      );

      if (!response || response.error) {
        throw new Error('daily check-in RPC rejected');
      }

      const result = parseDailyCheckInRow(response.data);
      if (!result) {
        throw new Error('daily check-in RPC returned an invalid result');
      }

      this.dailyCheckInMetrics.recordDailyCheckInClaim(result.claimed);
      this.dailyCheckInMetrics.observeCoinTransactionLatency(
        'daily_checkin',
        (Date.now() - startedAt) / 1000,
      );

      return result;
    } catch {
      // The controller historically converts thrown errors into a fake balance
      // of 50. Return an explicit additive unavailable state instead so no
      // fabricated balance is exposed and no client shows a reward it did not
      // receive. A later login/reload can safely retry the idempotent RPC.
      this.dailyCheckInMetrics.recordCoinPurchaseError(
        'daily_checkin',
        'atomic_rpc_unavailable',
      );
      this.dailyCheckInMetrics.observeCoinTransactionLatency(
        'daily_checkin',
        (Date.now() - startedAt) / 1000,
      );
      this.dailyCheckInLogger.warn(
        'Daily check-in reward is temporarily unavailable',
      );

      return {
        claimed: false,
        coins_rewarded: 0,
        new_balance: 0,
        unavailable: true,
      };
    }
  }
}
