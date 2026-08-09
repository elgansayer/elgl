import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { DecksService } from './decks.service';
import {
  AddFlashcardToDeckDto,
  CreateDeckDto,
  UpdateDeckDto,
} from './dto/deck.dto';
import { Deck } from './interfaces/deck.interface';

@ApiTags('Spaced Repetition (SRS) / Decks')
@Controller('decks')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post()
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a new flashcard deck',
    description:
      'Creates a new deck belonging to the authenticated user. Decks are used to organise flashcards into thematic groups (e.g. French Basics, Travel Phrases).',
  })
  @ApiResponse({ status: 201, description: 'Deck created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createDeck(
    @CurrentUser() user: User | null,
    @Body() dto: CreateDeckDto,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.createDeck(user.id, dto);
  }

  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'List all decks for the authenticated user',
    description:
      'Returns all flashcard decks owned by the user, including card_count for each deck.',
  })
  @ApiResponse({ status: 200, description: 'Array of decks.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDecks(@CurrentUser() user: User | null): Promise<Deck[]> {
    if (!user) return [];
    return await this.decksService.getDecks(user.id);
  }

  @Get(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'Get a single deck by ID',
    description: 'Returns the full deck object for the given ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({ status: 200, description: 'Deck object.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 404,
    description: 'Deck not found or does not belong to user.',
  })
  async getDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.getDeck(user.id, id);
  }

  @Patch(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Update a deck',
    description:
      'Partially updates the deck name, description, colour, or icon.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck to update',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({ status: 200, description: 'Deck updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Deck not found.' })
  async updateDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ): Promise<Deck | null> {
    if (!user) return null;
    return await this.decksService.updateDeck(user.id, id, dto);
  }

  @Delete(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Delete a deck',
    description:
      'Permanently deletes the deck and all its flashcard associations. Individual flashcards are not deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck to delete',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({ status: 200, description: 'Deck deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async deleteDeck(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.deleteDeck(user.id, id);
    return { success: true };
  }

  @Post(':id/flashcards')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Add a flashcard to a deck',
    description: 'Associates an existing flashcard with the specified deck.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiResponse({ status: 201, description: 'Flashcard added to deck.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async addFlashcard(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
    @Body() dto: AddFlashcardToDeckDto,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.addFlashcardToDeck(
      user.id,
      deckId,
      dto.flashcard_id,
    );
    return { success: true };
  }

  @Delete(':id/flashcards/:flashcardId')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Remove a flashcard from a deck',
    description:
      'Removes the association between the flashcard and the deck. The flashcard itself is not deleted.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiParam({
    name: 'flashcardId',
    description: 'UUID of the flashcard to remove',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  @ApiResponse({ status: 200, description: 'Flashcard removed from deck.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async removeFlashcard(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
    @Param('flashcardId') flashcardId: string,
  ): Promise<{ success: boolean }> {
    if (!user) return { success: false };
    await this.decksService.removeFlashcardFromDeck(
      user.id,
      deckId,
      flashcardId,
    );
    return { success: true };
  }

  @Get(':id/flashcards')
  @UseInterceptors(new CacheControlInterceptor(CACHE_EDGE_MEDIUM))
  @ApiOperation({
    summary: 'List flashcards in a deck',
    description:
      'Returns paginated flashcard IDs currently associated with this deck. Hard cap of 200 per page.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the deck',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max items per page (1-200, default 50)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip (default 0)',
    example: 0,
  })
  @ApiResponse({ status: 200, description: 'Array of flashcard IDs.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDeckFlashcards(
    @CurrentUser() user: User | null,
    @Param('id') deckId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ id: string }[]> {
    if (!user) return [];
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 50;
    const offsetNum = offset !== undefined ? parseInt(offset, 10) : 0;
    return await this.decksService.getDeckFlashcards(
      user.id,
      deckId,
      limitNum,
      offsetNum,
    );
  }
}
