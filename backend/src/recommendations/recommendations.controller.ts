import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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

interface AuthenticatedRequest {
  user?: { id: string };
}

@ApiTags('Matchmaking & Discovery')
@Controller('recommendations')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

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
          id: { type: 'string', example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789' },
          displayName: { type: 'string', nullable: true, example: 'Taro Yamada' },
          avatarUrl: { type: 'string', nullable: true, example: 'https://r2.example.com/avatars/taro.jpg' },
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
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT.' })
  async getForYou(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getRecommendations(userId);
  }

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
          id: { type: 'string', example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789' },
          displayName: { type: 'string', nullable: true, example: 'Maria Garcia' },
          avatarUrl: { type: 'string', nullable: true, example: 'https://r2.example.com/avatars/maria.jpg' },
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
  @ApiResponse({ status: 401, description: 'Unauthorized - missing or invalid JWT.' })
  async getDaily(
    @Req() req: AuthenticatedRequest,
  ): Promise<RecommendedUserDto[]> {
    const userId = req.user!.id;
    return this.recommendationsService.getDailyRecommendations(userId);
  }
}
