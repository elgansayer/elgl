import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_SHORT,
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
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_SHORT))
  @ApiOperation({
    summary: 'Suggest new vocabulary from a user message',
    description:
      'Tokenises the input message using Intl.Segmenter, extracts unique word tokens, optionally excludes already-known words (SRS level 4), and returns a list of suggestions to add as flashcards.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of suggested word tokens.',
    schema: {
      example: { suggestions: ['apprendre', 'francais', 'amis'] },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async suggest(@Query() dto: SuggestFlashcardsDto) {
    return this.suggestService.suggestFromMessage(dto);
  }
}
