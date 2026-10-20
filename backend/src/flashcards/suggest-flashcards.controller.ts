import {
  Controller,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_SHORT,
  CACHE_TAG_SUGGESTIONS,
} from '../common/cache.interceptor';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import { SuggestFlashcardsService } from './suggest-flashcards.service';

@ApiTags('Spaced Repetition (SRS) / Suggest')
@Controller('flashcards/suggest')
@UseGuards(SupabaseAuthGuard, SrsRateLimiterGuard)
@ApiBearerAuth()
export class SuggestFlashcardsController {
  constructor(private readonly suggestService: SuggestFlashcardsService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_SUGGESTIONS]),
  )
  @ApiOperation({
    summary: 'Suggest new vocabulary from a user message',
    description:
      'Tokenises the input message using Intl.Segmenter, extracts unique word tokens, and by default excludes words the authenticated user has already mastered at SRS level 4.',
  })
  @ApiQuery({
    name: 'message',
    required: true,
    description:
      'Raw text (chat message, article snippet, etc.) to extract vocabulary suggestions from.',
    example: "J'apprends le francais avec mes amis.",
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    deprecated: true,
    description:
      'Deprecated compatibility parameter. It is ignored; known-word filtering is always scoped to the authenticated user.',
  })
  @ApiQuery({
    name: 'target_language',
    required: false,
    description: 'BCP 47 language tag used for locale-aware word segmentation.',
    example: 'fr',
  })
  @ApiQuery({
    name: 'exclude_known',
    required: false,
    description:
      'Set to false to include already-mastered words (SRS level 4) in suggestions. Default: true.',
    example: 'true',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of suggested word tokens.',
    schema: {
      example: { suggestions: ['apprendre', 'francais', 'amis'] },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid message or target language.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized -- missing or invalid JWT.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests -- rate limit exceeded (20 req/min).',
  })
  @ApiResponse({
    status: 503,
    description:
      'Known-word filtering is temporarily unavailable; the endpoint fails closed rather than returning mastered words as new suggestions.',
  })
  async suggest(
    @CurrentUser() user: User | null,
    @Query() dto: SuggestFlashcardsDto,
  ) {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.suggestService.suggestFromMessage(user.id, dto);
  }
}
