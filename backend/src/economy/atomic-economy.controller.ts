import {
  Controller,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { CoinEconomyHealthService } from './coin-economy-health.service';
import { EconomyController } from './economy.controller';
import { EconomyExceptionFilter } from './economy-exception.filter';
import {
  EconomyRateLimit,
  EconomyRateLimiterGuard,
} from './economy-rate-limiter.guard';
import { EconomyService } from './economy.service';

/**
 * Production economy controller with a database-authoritative daily claim.
 * Other EconomyController endpoints are inherited unchanged.
 */
@ApiTags('Virtual Coin Economy')
@Controller('economy')
@UseGuards(SupabaseAuthGuard, EconomyRateLimiterGuard)
@UseFilters(EconomyExceptionFilter)
@ApiBearerAuth()
export class AtomicEconomyController extends EconomyController {
  constructor(
    private readonly atomicEconomyService: EconomyService,
    healthService: CoinEconomyHealthService,
  ) {
    super(atomicEconomyService, healthService);
  }

  @Post('daily-check-in')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 3, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Claim daily check-in reward',
    description:
      'Atomically claims a random daily reward of 5-10 coins for the authenticated user. ' +
      'Each user can claim at most once per UTC calendar day. Repeated and concurrent requests are idempotent.',
  })
  @ApiResponse({
    status: 201,
    description: 'Daily check-in result.',
    schema: {
      type: 'object',
      properties: {
        claimed: { type: 'boolean', example: true },
        coins_rewarded: { type: 'number', example: 7 },
        new_balance: { type: 'number', example: 257 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 503,
    description: 'Daily check-in is temporarily unavailable.',
  })
  override async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return null;
    return this.atomicEconomyService.claimDailyCheckIn(user.id);
  }
}
