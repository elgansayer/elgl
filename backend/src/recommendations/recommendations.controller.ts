import { Controller, Get, Req, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  RecommendationsService,
  RecommendedUserDto,
} from './recommendations.service';
import { MatchmakingExceptionFilter } from './matchmaking-exception.filter';

interface AuthenticatedRequest {
  user?: { id: string };
}

@ApiTags('Matchmaking & Discovery')
@Controller('recommendations')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
@UseFilters(MatchmakingExceptionFilter)
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
    summary: 'Get personalised "For You" recommendations',
    description:
      'Returns recommended language partners using a multi-tier matchmaking algorithm. ' +
      'Tier 1: interest-based matching via shared user_interests tags. ' +
      'Tier 2: language-exchange matching (complementary native/target languages). ' +
      'Tier 3: most active users by study_streak_days. ' +
      'Tier 4: mock data as ultimate fallback. ' +
      'Each tier degrades gracefully to the next when empty or unavailable.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of recommended users with matchTier indicating which algorithm tier produced each result.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
          },
          displayName: {
            type: 'string',
            nullable: true,
            example: 'Taro Yamada',
          },
          avatarUrl: {
            type: 'string',
            nullable: true,
            example: 'https://r2.example.com/avatars/taro.jpg',
          },
          nativeLanguage: { type: 'string', nullable: true, example: 'ja-JP' },
          targetLanguages: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            example: ['en', 'ko'],
          },
          sharedInterests: { type: 'number', example: 3 },
          isSeriousLearner: { type: 'boolean', nullable: true, example: true },
          studyStreakDays: { type: 'number', nullable: true, example: 30 },
          correctionRatio: { type: 'number', nullable: true, example: 0.95 },
          matchTier: {
            type: 'string',
            nullable: true,
            enum: ['interest', 'language_exchange', 'active_users', 'mock'],
            example: 'interest',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
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
    summary: 'Get daily cached language exchange recommendations',
    description:
      'Returns up to 10 language exchange partners cached in Redis via the nightly cron job. ' +
      'Gracefully degrades: Redis cache -> live language-exchange computation -> empty array. ' +
      'The nightly calculation uses complementary native/target language matching ordered by is_serious_learner.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of up to 10 recommended language exchange partners. May be empty if no cache exists and live computation returns no results.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
          },
          displayName: {
            type: 'string',
            nullable: true,
            example: 'Maria Garcia',
          },
          avatarUrl: {
            type: 'string',
            nullable: true,
            example: 'https://r2.example.com/avatars/maria.jpg',
          },
          nativeLanguage: { type: 'string', nullable: true, example: 'es' },
          targetLanguages: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            example: ['en', 'fr'],
          },
          sharedInterests: { type: 'number', example: 0 },
          isSeriousLearner: { type: 'boolean', nullable: true, example: true },
          studyStreakDays: { type: 'number', nullable: true, example: 15 },
          correctionRatio: { type: 'number', nullable: true, example: 0.88 },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getDailyRecommendations(userId);
  }
}
