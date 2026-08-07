import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SuggestFlashcardsDto } from './dto/suggest-flashcards.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Flashcards / Suggest')
@Controller('flashcards/suggest')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class SuggestFlashcardsController {
  constructor(private readonly suggestService: SuggestFlashcardsService) {}

  @Get()
  @ApiOperation({ summary: 'Suggest new vocabulary from a user message' })
  async suggest(@Query() dto: SuggestFlashcardsDto) {
    return this.suggestService.suggestFromMessage(dto);
  }
}
