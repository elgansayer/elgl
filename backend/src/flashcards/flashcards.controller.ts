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
import { Flashcard, PaginatedResponse } from './interfaces/flashcard.interface';
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PaginatedResponse<Flashcard>> {
    if (!user) return { data: [], total: 0, limit: 50, offset: 0 };
    const lvlNum = level !== undefined ? parseInt(level, 10) : undefined;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : undefined;
    return await this.flashcardsService.getFlashcards(user.id, lvlNum, limitNum, offsetNum);
  }

  @Get('due')
  async getDueReviews(
    @CurrentUser() user: User | null,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PaginatedResponse<Flashcard>> {
    if (!user) return { data: [], total: 0, limit: 50, offset: 0 };
    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : undefined;
    return await this.flashcardsService.getDueReviews(user.id, limitNum, offsetNum);
  }
}
