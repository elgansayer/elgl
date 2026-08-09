import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDeckDto, UpdateDeckDto } from './dto/deck.dto';
import { Deck } from './interfaces/deck.interface';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class DecksService {
  constructor(
    @InjectPinoLogger(DecksService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  async createDeck(userId: string, dto: CreateDeckDto): Promise<Deck> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('decks')
      .insert({
        user_id: userId,
        name: dto.name,
        description: dto.description ?? null,
        colour: dto.colour ?? '#6366f1',
        icon: dto.icon ?? '📚',
        card_count: 0,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, deckName: dto.name, error: msg },
        'Failed to create deck',
      );
      throw new Error(`Failed to create deck: ${msg}`);
    }

    this.logger.info(
      { userId, deckId: response.data.id, deckName: dto.name },
      'Deck created',
    );
    this.metricsService.recordSrsDeckCreated();
    return response.data;
  }

  async getDecks(userId: string): Promise<Deck[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (response.error || !response.data) {
      return [];
    }
    return response.data;
  }

  async getDeck(userId: string, deckId: string): Promise<Deck | null> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('decks')
      .select('*')
      .eq('id', deckId)
      .eq('user_id', userId)
      .single();

    if (response.error || !response.data) {
      return null;
    }
    return response.data;
  }

  async updateDeck(
    userId: string,
    deckId: string,
    dto: UpdateDeckDto,
  ): Promise<Deck> {
    const supabase = this.supabaseService.getClient();

    const response = await supabase
      .from('decks')
      .update({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.colour !== undefined ? { colour: dto.colour } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', deckId)
      .eq('user_id', userId)
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      this.logger.error(
        { userId, deckId, error: msg },
        'Failed to update deck',
      );
      throw new Error(`Failed to update deck: ${msg}`);
    }

    this.logger.info({ userId, deckId }, 'Deck updated');
    return response.data;
  }

  async deleteDeck(userId: string, deckId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', userId);

    if (response.error) {
      this.logger.error(
        { userId, deckId, error: response.error.message },
        'Failed to delete deck',
      );
      throw new Error(`Failed to delete deck: ${response.error.message}`);
    }

    this.logger.info({ userId, deckId }, 'Deck deleted');
  }

  async addFlashcardToDeck(
    userId: string,
    deckId: string,
    flashcardId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Verify the deck belongs to the user
    const deck = await this.getDeck(userId, deckId);
    if (!deck) {
      this.logger.warn({ userId, deckId, flashcardId }, 'Deck not found');
      throw new Error('Deck not found');
    }

    // Insert junction record
    const response = await supabase
      .from('deck_flashcards')
      .upsert(
        { deck_id: deckId, flashcard_id: flashcardId },
        { onConflict: 'deck_id, flashcard_id' },
      )
      .select()
      .single();

    if (response.error) {
      this.logger.error(
        { userId, deckId, flashcardId, error: response.error.message },
        'Failed to add flashcard to deck',
      );
      throw new Error(
        `Failed to add flashcard to deck: ${response.error.message}`,
      );
    }

    // Update card count
    await this.recalculateCardCount(supabase, deckId);
    this.logger.debug(
      { userId, deckId, flashcardId },
      'Flashcard added to deck',
    );
  }

  async removeFlashcardFromDeck(
    userId: string,
    deckId: string,
    flashcardId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const deck = await this.getDeck(userId, deckId);
    if (!deck) {
      this.logger.warn({ userId, deckId, flashcardId }, 'Deck not found');
      throw new Error('Deck not found');
    }

    const response = await supabase
      .from('deck_flashcards')
      .delete()
      .eq('deck_id', deckId)
      .eq('flashcard_id', flashcardId);

    if (response.error) {
      this.logger.error(
        { userId, deckId, flashcardId, error: response.error.message },
        'Failed to remove flashcard from deck',
      );
      throw new Error(
        `Failed to remove flashcard from deck: ${response.error.message}`,
      );
    }

    await this.recalculateCardCount(supabase, deckId);
    this.logger.debug(
      { userId, deckId, flashcardId },
      'Flashcard removed from deck',
    );
  }

  async getDeckFlashcards(
    userId: string,
    deckId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ id: string }[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const safeOffset = Math.max(0, offset);
    const supabase = this.supabaseService.getClient();

    const deck = await this.getDeck(userId, deckId);
    if (!deck) throw new Error('Deck not found');

    const response = await supabase
      .from('deck_flashcards')
      .select('flashcard_id')
      .eq('deck_id', deckId)
      .range(safeOffset, safeOffset + safeLimit - 1)
      .order('added_at', { ascending: false });

    if (response.error || !response.data) {
      return [];
    }
    return response.data.map((row) => ({ id: row.flashcard_id }));
  }

  private async recalculateCardCount(
    supabase: ReturnType<SupabaseService['getClient']>,
    deckId: string,
  ): Promise<void> {
    const countResponse = await supabase
      .from('deck_flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId);

    const count = countResponse.count ?? 0;
    await supabase
      .from('decks')
      .update({ card_count: count, updated_at: new Date().toISOString() })
      .eq('id', deckId);
  }
}
