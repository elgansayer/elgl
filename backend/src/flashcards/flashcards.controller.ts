import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { Flashcard } from './interfaces/flashcard.interface';
import { FlashcardsService } from './flashcards.service';

@Controller('flashcards')
@UseGuards(SupabaseAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post()
  async createFlashcard(
    @CurrentUser() user: User | null,
    @Body() dto: CreateFlashcardDto,
  ): Promise<Flashcard | null> {
    if (!user) return null;
    return await this.flashcardsService.createOrUpdateFlashcard(user.id, dto);
  }

  @Patch(':id/srs')
  async updateSrs(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateSrsDto,
  ): Promise<Flashcard | null> {
    if (!user) return null;
    return await this.flashcardsService.updateSrsLevel(user.id, id, dto);
  }

  @Get()
  async getFlashcards(
    @CurrentUser() user: User | null,
    @Query('level') level?: string,
  ): Promise<Flashcard[]> {
    if (!user) return [];
    const lvlNum = level !== undefined ? parseInt(level, 10) : undefined;
    return await this.flashcardsService.getFlashcards(user.id, lvlNum);
  }

  @Get('due')
  async getDueReviews(@CurrentUser() user: User | null): Promise<Flashcard[]> {
    if (!user) return [];
    return await this.flashcardsService.getDueReviews(user.id);
  }
}
