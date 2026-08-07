import { Controller, Get, Req, UseFilters, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { sanitiseRecommendationsData } from './sanitise-recommendations.helper';
import {
  RecommendationsRateLimiterGuard,
  RecommendationsRateLimit,
} from './recommendations-rate-limiter.guard';

interface AuthenticatedRequest {
  user?: { id: string };
}

@Controller('recommendations')
@UseGuards(SupabaseAuthGuard, RecommendationsRateLimiterGuard)
@UseFilters(MatchmakingExceptionFilter)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('for-you')
  @RecommendationsRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
  async getForYou(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    const results = await this.recommendationsService.getRecommendations(userId);
    return sanitiseRecommendationsData(results);
  }

  @Get('daily')
  @RecommendationsRateLimit({ freeMaxRequests: 10, vipMaxRequests: 60, windowSeconds: 60 })
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    const results = await this.recommendationsService.getDailyRecommendations(userId);
    return sanitiseRecommendationsData(results);
  }
}
