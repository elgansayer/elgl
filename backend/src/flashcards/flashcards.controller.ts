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
  CACHE_EDGE_VERY_SHORT,
  CACHE_NO_STORE,
  CACHE_TAG_FLASHCARDS,
  CACHE_TAG_DUE_REVIEWS,
} from '../common/cache.interceptor';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
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
    const result = await this.flashcardsService.createOrUpdateFlashcard(user.id, dto);
    // Invalidate Cloudflare edge cache for this user's flashcard lists and due reviews
    void this.flashcardsService.purgeSrsCache(user.id);
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
    const result = await this.flashcardsService.updateSrsLevel(user.id, id, dto);
    // Invalidate Cloudflare edge cache for this user's flashcard lists and due reviews
    void this.flashcardsService.purgeSrsCache(user.id);
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
      'Returns flashcards owned by the user, ordered by creation date descending, with pagination. Optionally filters by SRS level (0-4).',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description:
      'Optional SRS level filter. 0: New (Blue), 1-3: Learning (Yellow), 4: Known (White).',
    example: '2',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of flashcards to return (1-500, default 100).',
    example: '50',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of flashcards to skip for pagination (default 0).',
    example: '0',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated flashcards with total count.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getFlashcards(
    @CurrentUser() user: User | null,
    @Query('level') level?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: Flashcard[]; total: number }> {
    if (!user) return { data: [], total: 0 };
    const lvlNum = level !== undefined ? parseInt(level, 10) : undefined;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 100;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : 0;
    return await this.flashcardsService.getFlashcards(user.id, lvlNum, limitNum, offsetNum);
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
      'Returns flashcards with srs_level < 4 whose next_review_at <= now, with pagination. Ordered by next_review_at ascending (most overdue first).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of flashcards to return (1-500, default 100).',
    example: '50',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of flashcards to skip for pagination (default 0).',
    example: '0',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated flashcards due for review.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDueReviews(
    @CurrentUser() user: User | null,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ data: Flashcard[]; total: number }> {
    if (!user) return { data: [], total: 0 };
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 100;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : 0;
    return await this.flashcardsService.getDueReviews(user.id, limitNum, offsetNum);
  }
}
