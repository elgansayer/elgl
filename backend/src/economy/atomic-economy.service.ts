import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CentrifugoService } from '../chat/centrifugo.service';
import { withExponentialBackoff } from '../common/http-retry.helper';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { EconomyService } from './economy.service';

interface DailyCheckInResult {
  claimed: boolean;
  coins_rewarded: number;
  new_balance: number;
}

interface DailyCheckInRpcClient {
  rpc(
    functionName: string,
    args: { p_user_id: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function isDailyCheckInResult(value: unknown): value is DailyCheckInResult {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('claimed' in value) ||
    typeof value.claimed !== 'boolean' ||
    !('coins_rewarded' in value) ||
    typeof value.coins_rewarded !== 'number' ||
    !Number.isInteger(value.coins_rewarded) ||
    !('new_balance' in value) ||
    typeof value.new_balance !== 'number' ||
    !Number.isInteger(value.new_balance) ||
    value.new_balance < 0
  ) {
    return false;
  }

  return value.claimed
    ? value.coins_rewarded >= 5 && value.coins_rewarded <= 10
    : value.coins_rewarded === 0;
}

/**
 * EconomyService variant that moves daily check-in idempotency into one
 * database transaction. Other economy behaviour remains inherited unchanged.
 */
@Injectable()
export class AtomicEconomyService extends EconomyService {
  constructor(
    @InjectPinoLogger(EconomyService.name)
    private readonly atomicLogger: PinoLogger,
    private readonly atomicSupabaseService: SupabaseService,
    usersService: UsersService,
    centrifugoService: CentrifugoService,
    configService: ConfigService,
    httpService: HttpService,
    private readonly atomicMetricsService: MetricsService,
  ) {
    super(
      atomicLogger,
      atomicSupabaseService,
      usersService,
      centrifugoService,
      configService,
      httpService,
      atomicMetricsService,
    );
  }

  override async claimDailyCheckIn(userId: string): Promise<DailyCheckInResult> {
    const startedAt = Date.now();

    try {
      const rpcClient = this.atomicSupabaseService.getClient() as unknown as DailyCheckInRpcClient;
      const response = await withExponentialBackoff(
        () => rpcClient.rpc('claim_daily_checkin', { p_user_id: userId }),
        'claimDailyCheckInAtomic',
        { logger: this.atomicLogger },
      );

      if (response.error) {
        throw new Error('daily check-in RPC failed');
      }

      const row = Array.isArray(response.data)
        ? response.data[0]
        : response.data;
      if (!isDailyCheckInResult(row)) {
        throw new Error('daily check-in RPC returned an invalid result');
      }

      this.atomicMetricsService.recordDailyCheckInClaim(row.claimed);
      if (row.claimed) this.invalidateStickerPackCache(userId);
      return row;
    } catch {
      this.atomicMetricsService.recordCoinPurchaseError(
        'daily_checkin',
        'atomic_claim',
      );
      this.atomicLogger.error('Daily check-in claim failed');
      throw new ServiceUnavailableException(
        'Daily check-in is temporarily unavailable.',
      );
    } finally {
      this.atomicMetricsService.observeCoinTransactionLatency(
        'daily_checkin',
        (Date.now() - startedAt) / 1000,
      );
    }
  }

  private invalidateStickerPackCache(userId: string): void {
    try {
      this.atomicSupabaseService
        .getRedisClient()
        .del(`economy:sticker_packs:${userId}`)
        .catch(() => undefined);
    } catch {
      // Cache invalidation is best effort; the cache has a bounded TTL.
    }
  }
}
