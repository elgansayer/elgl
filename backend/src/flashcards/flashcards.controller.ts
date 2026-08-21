import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
  CACHE_EDGE_VERY_SHORT,
  CACHE_NO_STORE,
  CACHE_TAG_FLASHCARDS,
  CACHE_TAG_DUE_REVIEWS,
} from '../common/cache.interceptor';
import {
  CreateFlashcardDto,
  QueryDueReviewsDto,
  QueryFlashcardsDto,
  UpdateSrsDto,
} from './dto/flashcard.dto';
import { Flashcard, SrsHealthStatus } from './interfaces/flashcard.interface';
import { FlashcardsService } from './flashcards.service';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';

@ApiTags('Spaced Repetition (SRS)')
@Controller('flashcards')
@UseGuards(SupabaseAuthGuard, SrsRateLimiterGuard)
@ApiBearerAuth()
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Get SRS health and degradation status',
    description:
      'Returns the current SRS health status indicating whether the system is operating in full or degraded mode.',
  })
  @ApiResponse({
    status: 200,
    description: 'SRS health status.',
  })
  getHealth(): SrsHealthStatus {
    return this.flashcardsService.getHealthStatus();
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 30, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create or update a flashcard',
    description:
      'Creates a new flashcard for the authenticated user, or updates an existing one if the word_token already exists. Upserts on (user_id, word_token) conflict.',
  })
  @ApiResponse({
    status: 201,
    description: 'Flashcard created or updated successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized -- missing or invalid JWT.',
  })
  async createFlashcard(
    @CurrentUser() user: User | null,
    @Body() dto: CreateFlashcardDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Flashcard | null> {
    if (!user) return null;
    const result = await this.flashcardsService.createOrUpdateFlashcard(
      user.id,
      dto,
    );
    if (result.degraded && res) {
      res.header('X-SRS-Degraded', 'true');
    }
    return result;
  }

  @Patch(':id/srs')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 120, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Submit an SRS review for a flashcard',
    description:
      'Applies the SM-2 spaced repetition algorithm based on the user recall quality score (0-5). Updates the easiness factor, interval, repetitions, srs_level, and next_review_at.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the flashcard being reviewed',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({
    status: 200,
    description:
      'SRS review applied successfully. Returns updated flashcard with new scheduling. When X-SRS-Degraded header is present, results are locally computed and not yet persisted.',
    headers: {
      'X-SRS-Degraded': {
        description:
          'Present when the SRS system is operating in degraded mode (database unavailable)',
        schema: { type: 'string', example: 'true' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 404,
    description: 'Flashcard not found or does not belong to user.',
  })
  async updateSrs(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateSrsDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Flashcard | null> {
    if (!user) return null;
    const result = await this.flashcardsService.updateSrsLevel(
      user.id,
      id,
      dto,
    );
    if (result.degraded && res) {
      res.header('X-SRS-Degraded', 'true');
    }
    return result;
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 30, windowSeconds: 60 })
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [CACHE_TAG_FLASHCARDS]),
  )
  @ApiOperation({
    summary: 'List flashcards for the authenticated user',
    description:
      'Returns flashcards owned by the user, ordered by creation date descending. Supports pagination via limit/offset. Optionally filters by SRS level (0-4).',
  })
  @ApiResponse({ status: 200, description: 'Array of flashcards.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getFlashcards(
    @CurrentUser() user: User | null,
    @Query() query: QueryFlashcardsDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Flashcard[]> {
    if (!user) return [];
    const result = await this.flashcardsService.getFlashcards(
      user.id,
      query.level,
      query.limit,
      query.offset,
    );
    if (result.some((c) => c.degraded) && res) {
      res.header('X-SRS-Degraded', 'true');
    }
    return result;
  }

  @Get('due')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 60, windowSeconds: 60 })
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_VERY_SHORT, [CACHE_TAG_DUE_REVIEWS]),
  )
  @ApiOperation({
    summary: 'Get flashcards due for review',
    description:
      'Returns flashcards with srs_level < 4 whose next_review_at <= now. Ordered by next_review_at ascending (most overdue first). Supports pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of flashcards due for review.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDueReviews(
    @CurrentUser() user: User | null,
    @Query() query: QueryDueReviewsDto,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<Flashcard[]> {
    if (!user) return [];
    const result = await this.flashcardsService.getDueReviews(
      user.id,
      query.limit,
      query.offset,
    );
    if (result.some((c) => c.degraded) && res) {
      res.header('X-SRS-Degraded', 'true');
    }
    return result;
  }
}
