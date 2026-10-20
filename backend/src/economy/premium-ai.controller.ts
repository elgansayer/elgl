import {
  Controller,
  Get,
  Post,
  Body,
  UnauthorizedException,
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
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { ConversationAnalysisDto } from './dto/premium-ai.dto';
import { EconomyExceptionFilter } from './economy-exception.filter';
import {
  EconomyRateLimit,
  EconomyRateLimiterGuard,
} from './economy-rate-limiter.guard';
import { PremiumAiService } from './premium-ai.service';

@ApiTags('Premium AI Coin Services')
@ApiBearerAuth()
@Controller('economy/premium-ai')
@UseGuards(SupabaseAuthGuard, EconomyRateLimiterGuard)
@UseFilters(EconomyExceptionFilter)
@UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
export class PremiumAiController {
  constructor(private readonly premiumAiService: PremiumAiService) {}

  @Get('services')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @ApiOperation({ summary: 'List coin-funded one-off AI services' })
  @ApiResponse({
    status: 200,
    description: 'Stable server-priced AI service catalog.',
  })
  getServices() {
    return this.premiumAiService.getCatalog();
  }

  @Post('conversation-analysis')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 3, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Spend coins for a one-off conversation learning analysis',
    description:
      'Charges the server-defined coin price exactly once per idempotency key, analyses recent messages in a room the caller belongs to, and refunds automatically if generation fails.',
  })
  @ApiResponse({ status: 201, description: 'Conversation report generated.' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient coins or insufficient conversation text.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Caller is not a room member.' })
  @ApiResponse({
    status: 409,
    description:
      'The same idempotency key is still processing; retry with the same key.',
  })
  @ApiResponse({
    status: 410,
    description:
      'The idempotency key belongs to a refunded/failed request or cannot be reused for this conversation; a new purchase must use a fresh key.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Refund/persistence reconciliation is ambiguous; retry with the same idempotency key before starting another purchase.',
  })
  @ApiResponse({
    status: 503,
    description:
      'AI provider or persistence temporarily unavailable; any charged coins were refunded before this response.',
  })
  async conversationAnalysis(
    @CurrentUser() user: User | null,
    @Body() dto: ConversationAnalysisDto,
  ) {
    if (!user) throw new UnauthorizedException('Authentication required.');
    return this.premiumAiService.runConversationAnalysis(user.id, dto);
  }
}
