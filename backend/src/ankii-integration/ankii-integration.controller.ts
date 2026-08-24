import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ImportAnkiTsvDto } from './dto/anki-import.dto';
import {
  AnkiImportResult,
  AnkiiIntegrationService,
} from './ankii-integration.service';

@ApiTags('Anki interoperability')
@ApiBearerAuth()
@Controller('anki')
@UseGuards(SupabaseAuthGuard)
export class AnkiiIntegrationController {
  constructor(private readonly ankiService: AnkiiIntegrationService) {}

  @Get('export')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Header('Content-Type', 'text/tab-separated-values; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="elgl-flashcards.tsv"')
  @ApiOperation({
    summary: 'Export the authenticated user flashcards as Anki-compatible TSV',
  })
  @ApiResponse({ status: 200, description: 'Anki-compatible UTF-8 TSV export.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async exportFlashcards(
    @CurrentUser() user: User | null,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<string> {
    if (!user) throw new UnauthorizedException('Authentication required');

    const result = await this.ankiService.exportUserFlashcards(user.id);
    res?.header('X-Anki-Exported', String(result.exported));
    res?.header('X-Anki-Truncated', String(result.truncated));
    return result.content;
  }

  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Import an Anki-compatible TSV file into the authenticated user flashcards',
    description:
      'Imports 2 to 4 tab-separated columns: Front, Back, optional Context, optional Definition. Existing SRS scheduling is preserved when a Front value already exists.',
  })
  @ApiResponse({ status: 201, description: 'Valid flashcards imported.' })
  @ApiResponse({ status: 400, description: 'Import payload is invalid or too large.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 503, description: 'Flashcard storage is unavailable.' })
  async importFlashcards(
    @CurrentUser() user: User | null,
    @Body() dto: ImportAnkiTsvDto,
  ): Promise<AnkiImportResult> {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.ankiService.importTsv(user.id, dto.content);
  }
}