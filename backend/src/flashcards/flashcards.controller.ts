import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import {
  CreateFlashcardDto,
  UpdateSrsDto,
  QueryFlashcardsDto,
  QueryDueReviewsDto,
} from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { FlashcardsService } from './flashcards.service';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';

@ApiTags('Spaced Repetition (SRS)')
@Controller('flashcards')
@UseGuards(SupabaseAuthGuard, SrsRateLimiterGuard)
@ApiBearerAuth()
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

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
  ): Promise<Flashcard | null> {
    if (!user) return null;
    return await this.flashcardsService.createOrUpdateFlashcard(user.id, dto);
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
      'SRS review applied successfully. Returns updated flashcard with new scheduling.',
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
  ): Promise<Flashcard | null> {
    if (!user) return null;
    return await this.flashcardsService.updateSrsLevel(user.id, id, dto);
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 30, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'List flashcards for the authenticated user',
    description:
      'Returns paginated flashcards owned by the user, ordered by creation date descending. Hard cap of 200 per page. Optionally filters by SRS level (0-4).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max flashcards per page (1-200, default 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of flashcards to skip (default 0)',
    example: 0,
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description:
      'Optional SRS level filter. 0: New (Blue), 1-3: Learning (Yellow), 4: Known (White).',
    example: '2',
  })
  @ApiResponse({ status: 200, description: 'Array of flashcards.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getFlashcards(
    @CurrentUser() user: User | null,
    @Query() query: QueryFlashcardsDto,
  ): Promise<Flashcard[]> {
    if (!user) return [];
    return await this.flashcardsService.getFlashcards(
      user.id,
      query.level,
      query.limit,
      query.offset,
    );
  }

  @Get('due')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 60, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get flashcards due for review',
    description:
      'Returns paginated flashcards with srs_level < 4 whose next_review_at <= now. Ordered by next_review_at ascending. Hard cap of 100 per page.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max dues per page (1-100, default 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of due reviews to skip (default 0)',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Array of flashcards due for review.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDueReviews(
    @CurrentUser() user: User | null,
    @Query() query: QueryDueReviewsDto,
  ): Promise<Flashcard[]> {
    if (!user) return [];
    return await this.flashcardsService.getDueReviews(
      user.id,
      query.limit,
      query.offset,
    );
  }
}
