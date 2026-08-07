import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { RecommendedUserResponseDto } from './dto/recommendations-response.dto';

interface AuthenticatedRequest {
  user?: { id: string };
}

@Controller('recommendations')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
@ApiTags('Matchmaking')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * GET /recommendations/for-you
   *
   * Returns personalised partner recommendations using a multi-tier
   * fallback architecture. The algorithm probes four tiers in order,
   * returning the first non-empty result:
   *
   * Tier 1 - Interest-based matching: Queries user_interests for
   * shared tags, ranks candidates by the count of shared interests,
   * then by serious-learner flag and study streak.
   *
   * Tier 2 - Language exchange matching: Finds complementary
   * native/target language pairs where a partner's native language
   * is in the user's target languages and vice versa.
   *
   * Tier 3 - Most active users: Falls back to a global list
   * ordered by study_streak_days descending.
   *
   * Tier 4 - Mock data: Returns seeded in-memory mock profiles so
   * the frontend is never left with an empty state.
   *
   * Results are limited to 20 candidates per request.
   * Blocked users are excluded at every tier.
   */
  @Get('for-you')
  @ApiOperation({
    summary: 'Multi-tier personalised partner recommendations',
    description: `Orchestrates a four-tier matchmaking pipeline with graceful degradation:

1. **Interest-based** -- shared user_interests tags, ranked by count and quality signals.
2. **Language exchange** -- complementary native/target language pairings.
3. **Most active users** -- global leaderboard by study streak.
4. **Mock data** -- hard-coded fallback ensuring the frontend always receives content.

Results are capped at **20 candidates**. Blocked users are excluded at every tier.
The matchTier field on each returned object indicates the tier that produced it.`,
  })
  @ApiOkResponse({
    description: 'A list of recommended partner profiles.',
    type: [RecommendedUserResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async getForYou(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getRecommendations(userId);
  }

  /**
   * GET /recommendations/daily
   *
   * Returns the top 10 language-exchange partners cached from the
   * nightly batch job (calculateDailyRecommendations). The cache
   * lives in Redis with a 24-hour TTL. On cache miss, falls back
   * to live language-exchange computation and ultimately to an
   * empty array if nothing is available.
   */
  @Get('daily')
  @ApiOperation({
    summary: 'Cached daily language-exchange recommendations',
    description: `Returns the top 10 language-exchange partners pre-computed
by a nightly cron job. Data is served from a Redis cache key
\`recommendations:daily:{userId}\` with a **24-hour TTL**.

On cache miss the endpoint performs a live language-exchange query.
If that also fails, an empty array is returned (this endpoint does
**not** use mock fallback data).`,
  })
  @ApiOkResponse({
    description:
      'A list of up to 10 recommended language-exchange partners.',
    type: [RecommendedUserResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getDailyRecommendations(userId);
  }
}
