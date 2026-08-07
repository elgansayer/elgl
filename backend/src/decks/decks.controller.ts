import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DecksService } from './decks.service';
import {
  AddFlashcardToDeckDto,
  CreateDeckDto,
  RemoveFlashcardFromDeckDto,
  UpdateDeckDto,
} from './dto/deck.dto';
import { Deck } from './interfaces/deck.interface';

@Controller('decks')
@UseGuards(SupabaseAuthGuard)
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post()
  async createDeck(
    @CurrentUser() user: User | null,
    @Body() dto: CreateDeckDto,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.createDeck(user.id, dto);
  }

  @Get()
  async getDecks(@CurrentUser() user: User | null): Promise<Deck[]> {
    if (!user) return [];
    return await this.decksService.getDecks(user.id);
  }

  @Get(':id')
  async getDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.getDeck(user.id, id);
  }

  @Patch(':id')
  async updateDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.updateDeck(user.id, id, dto);
  }

  @Delete(':id')
  async deleteDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.deleteDeck(user.id, id);
    return { success: true };
  }

  @Post(':id/flashcards')
  async addFlashcard(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
    @Body() dto: AddFlashcardToDeckDto,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.addFlashcardToDeck(user.id, deckId, dto.flashcard_id);
    return { success: true };
  }

  @Delete(':id/flashcards/:flashcardId')
  async removeFlashcard(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
    @Param('flashcardId') flashcardId: string,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.removeFlashcardFromDeck(user.id, deckId, flashcardId);
    return { success: true };
  }

  @Get(':id/flashcards')
  async getDeckFlashcards(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
  ): Promise<{ id: string }[]> {
    if (!user) return [];
    return await this.decksService.getDeckFlashcards(user.id, deckId);
  }
}