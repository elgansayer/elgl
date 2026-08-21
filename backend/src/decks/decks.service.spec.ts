import { Test, TestingModule } from '@nestjs/testing';
import { DecksService } from './decks.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { PinoLogger } from 'nestjs-pino';
import { InjectPinoLogger } from 'nestjs-pino';

describe('DecksService', () => {
  let service: DecksService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  // Helper to make the mock query builder thenable (awaitable)
  function makeThenable(obj: any, resolveValue: any): void {
    obj.then = (resolve: any) => {
      if (typeof resolve !== 'function') return resolveValue;
      return resolve(resolveValue);
    };
  }

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      then: undefined as any,
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        {
          provide: MetricsService,
          useValue: {
            recordSrsFlashcardCreated: vi.fn(),
            recordSrsReviewCompleted: vi.fn(),
            setSrsDueCards: vi.fn(),
            setSrsAverageEasinessFactor: vi.fn(),
            setSrsReviewSuccessRate: vi.fn(),
            setSrsCardsPerLevel: vi.fn(),
            setSrsCardsStuck: vi.fn(),
            setSrsDecksTotal: vi.fn(),
            recordSrsDeckCreated: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: `PinoLogger:${DecksService.name}`,
          useValue: {
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeck', () => {
    it('should create a deck successfully', async () => {
      const dto = { name: 'Spanish Verbs', colour: '#ff5500', icon: '🔥' };
      const savedDeck = {
        id: 'deck-1',
        user_id: 'user-1',
        name: 'Spanish Verbs',
        card_count: 0,
        colour: '#ff5500',
        icon: '🔥',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedDeck,
        error: null,
      });

      const result = await service.createDeck('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('decks');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Spanish Verbs',
          colour: '#ff5500',
          icon: '🔥',
          card_count: 0,
        }),
      );
      expect(result).toEqual(savedDeck);
    });

    it('should use default colour and icon when not provided', async () => {
      const dto = { name: 'Test' };
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'deck-2', name: 'Test', colour: '#6366f1', icon: '📚' },
        error: null,
      });

      await service.createDeck('user-1', dto);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ colour: '#6366f1', icon: '📚' }),
      );
    });

    it('should throw when creation fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });
      await expect(service.createDeck('user-1', { name: 'X' })).rejects.toThrow(
        'Failed to create deck',
      );
    });
  });

  describe('getDecks', () => {
    it('should return user decks', async () => {
      const decks = [
        { id: 'd1', name: 'Deck 1' },
        { id: 'd2', name: 'Deck 2' },
      ];
      mockQueryBuilder.order.mockResolvedValue({ data: decks, error: null });

      const result = await service.getDecks('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('decks');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual(decks);
    });

    it('should return empty array on error', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      const result = await service.getDecks('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getDeck', () => {
    it('should return a single deck', async () => {
      const deck = { id: 'd1', name: 'My Deck' };
      mockQueryBuilder.single.mockResolvedValue({ data: deck, error: null });
      const result = await service.getDeck('user-1', 'd1');
      expect(result).toEqual(deck);
    });

    it('should return null when not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      const result = await service.getDeck('user-1', 'd1');
      expect(result).toBeNull();
    });
  });

  describe('updateDeck', () => {
    it('should update deck fields', async () => {
      const dto = { name: 'Updated Name', description: 'New desc' };
      const updatedDeck = {
        id: 'd1',
        name: 'Updated Name',
        description: 'New desc',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: updatedDeck,
        error: null,
      });

      const result = await service.updateDeck('user-1', 'd1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('decks');
      expect(result).toEqual(updatedDeck);
    });

    it('should throw on update failure', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });
      await expect(
        service.updateDeck('user-1', 'd1', { name: 'X' }),
      ).rejects.toThrow('Failed to update deck');
    });
  });

  describe('deleteDeck', () => {
    it('should delete a deck', async () => {
      // For delete: from('decks').delete().eq(id).eq(user_id)
      // The final builder is the thenable itself
      mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
      makeThenable(mockQueryBuilder, { data: null, error: null });

      await expect(service.deleteDeck('user-1', 'd1')).resolves.toBeUndefined();
    });

    it('should throw on delete failure', async () => {
      mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
      makeThenable(mockQueryBuilder, {
        data: null,
        error: { message: 'Forbidden' },
      });

      await expect(service.deleteDeck('user-1', 'd1')).rejects.toThrow(
        'Failed to delete deck',
      );
    });
  });

  describe('addFlashcardToDeck', () => {
    it('should throw when deck not found', async () => {
      // getDeck call: single() resolves with error
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      // Need eq to return mockQueryBuilder for chaining
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      // select needs to return mockQueryBuilder for chaining
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);

      await expect(
        service.addFlashcardToDeck('user-1', 'bad-id', 'fc1'),
      ).rejects.toThrow('Deck not found');
    });
  });

  describe('getDeckFlashcards', () => {
    it('should return flashcard ids for a deck', async () => {
      // getDeck: from('decks').select().eq('id').eq('user_id').single()
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'd1', name: 'Test', user_id: 'user-1' },
        error: null,
      });

      // Then from('deck_flashcards').select().eq().order()
      // The order returns the final thenable
      const flashcardData = {
        data: [{ flashcard_id: 'fc1' }, { flashcard_id: 'fc2' }],
        error: null,
      };
      mockQueryBuilder.order.mockResolvedValue(flashcardData);

      const result = await service.getDeckFlashcards('user-1', 'd1');

      expect(result).toEqual([{ id: 'fc1' }, { id: 'fc2' }]);
      // Verify from was called with both tables
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('decks');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('deck_flashcards');
    });

    it('should throw when deck not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);

      await expect(
        service.getDeckFlashcards('user-1', 'bad-id'),
      ).rejects.toThrow('Deck not found');
    });
  });
});
