import {
  Controller,
  Get,
  Query,
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
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_SHORT,
  CACHE_TAG_SUGGESTIONS,
} from '../common/cache.interceptor';

@ApiTags('Spaced Repetition (SRS) / Suggest')
@Controller('flashcards/suggest')
@UseGuards(SupabaseAuthGuard, SrsRateLimiterGuard)
@ApiBearerAuth()
export class SuggestFlashcardsController {
  constructor(private readonly suggestService: SuggestFlashcardsService) {}

  /**
   * Suggestion is deterministic for the same input and knowledge base.
   * Short-lived private cache reduces DB and NLP read pressure.
   */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @SrsRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(
    new CacheControlInterceptor(CACHE_EDGE_SHORT, [CACHE_TAG_SUGGESTIONS]),
  )
  @ApiOperation({
    summary: 'Suggest new vocabulary from a user message',
    description:
      'Tokenises the input message using Intl.Segmenter, extracts unique word tokens, optionally excludes already-known words (SRS level 4), and returns a list of suggestions to add as flashcards.',
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
    description:
      'UUID of the user. When provided and exclude_known=true, words already at SRS level 4 are filtered out.',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiQuery({
    name: 'target_language',
    required: false,
    description:
      'ISO 639-1 language code for Intl.Segmenter locale-aware tokenisation.',
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
    status: 401,
    description: 'Unauthorized -- missing or invalid JWT.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests -- rate limit exceeded (20 req/min).',
  })
  async suggest(@Query() dto: SuggestFlashcardsDto) {
    return this.suggestService.suggestFromMessage(dto);
  }
}
