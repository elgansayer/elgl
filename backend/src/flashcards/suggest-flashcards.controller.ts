import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_SHORT,
} from '../common/cache';

@ApiTags('Spaced Repetition (SRS) / Suggest')
@Controller('flashcards/suggest')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class SuggestFlashcardsController {
  constructor(private readonly suggestService: SuggestFlashcardsService) {}

  /**
   * Suggestions depend on the user's known words, so the response is
   * private.  Allow the browser a short cache but forbid CDN storage.
   */
  @Get()
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
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_SHORT))
  async suggest(@Query() dto: SuggestFlashcardsDto) {
    return this.suggestService.suggestFromMessage(dto);
  }
}
