import {
  Controller,
  Get,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimit, SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import { AnkiExportService } from './anki-export.service';

@ApiTags('Spaced Repetition (SRS)')
@Controller('flashcards/anki')
@UseGuards(SupabaseAuthGuard, SrsRateLimiterGuard)
@ApiBearerAuth()
export class AnkiExportController {
  constructor(private readonly ankiExportService: AnkiExportService) {}

  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @SrsRateLimit({ maxRequests: 5, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Export the authenticated user flashcard library for Anki',
    description:
      'Returns a bounded UTF-8 tab-separated Anki import file. User-authored fields are HTML escaped and pronunciation URLs are preserved only for HTTP(S) sources.',
  })
  @ApiResponse({ status: 200, description: 'Anki-compatible TSV download.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 503, description: 'Flashcard storage unavailable.' })
  async exportForAnki(
    @CurrentUser() user: User | null,
    @Res() response: Response,
  ): Promise<void> {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const result = await this.ankiExportService.exportUserFlashcards(user.id);
    const date = new Date().toISOString().slice(0, 10);

    response.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="elgl-anki-${date}.tsv"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Anki-Export-Count', String(result.count));
    response.setHeader('X-Anki-Export-Truncated', String(result.truncated));
    response.send(result.content);
  }
}
