import { Test, TestingModule } from '@nestjs/testing';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('DecksController', () => {
  let controller: DecksController;
  let service: DecksService;

  const mockDecksService = {
    createDeck: vi.fn(),
    getDecks: vi.fn(),
    getDeck: vi.fn(),
    updateDeck: vi.fn(),
    deleteDeck: vi.fn(),
    addFlashcardToDeck: vi.fn(),
    removeFlashcardFromDeck: vi.fn(),
    getDeckFlashcards: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DecksController],
      providers: [{ provide: DecksService, useValue: mockDecksService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DecksController>(DecksController);
    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDeck', () => {
    it('should create a deck for authenticated user', async () => {
      const dto = { name: 'Spanish Verbs' };
      const deck = { id: 'd1', name: 'Spanish Verbs', user_id: 'user-1' };
      mockDecksService.createDeck.mockResolvedValue(deck);

      const result = await controller.createDeck({ id: 'user-1' } as any, dto);
      expect(result).toEqual(deck);
      expect(service.createDeck).toHaveBeenCalledWith('user-1', dto);
    });

    it('should return null when user is not authenticated', async () => {
      const result = await controller.createDeck(null, { name: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('getDecks', () => {
    it('should return decks for authenticated user', async () => {
      const decks = [{ id: 'd1', name: 'Deck 1' }];
      mockDecksService.getDecks.mockResolvedValue(decks);
      const result = await controller.getDecks({ id: 'user-1' } as any);
      expect(result).toEqual(decks);
    });

    it('should return empty array when user is null', async () => {
      const result = await controller.getDecks(null);
      expect(result).toEqual([]);
    });
  });

  describe('deleteDeck', () => {
    it('should delete deck for authenticated user', async () => {
      mockDecksService.deleteDeck.mockResolvedValue(undefined);
      const result = await controller.deleteDeck({ id: 'user-1' } as any, 'd1');
      expect(result).toEqual({ success: true });
      expect(service.deleteDeck).toHaveBeenCalledWith('user-1', 'd1');
    });

    it('should return false when user is null', async () => {
      const result = await controller.deleteDeck(null, 'd1');
      expect(result).toEqual({ success: false });
    });
  });

  describe('addFlashcard', () => {
    it('should add flashcard to deck', async () => {
      mockDecksService.addFlashcardToDeck.mockResolvedValue(undefined);
      const result = await controller.addFlashcard(
        { id: 'user-1' } as any,
        'd1',
        { flashcard_id: 'fc1' },
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getDeckFlashcards', () => {
    it('should return flashcard IDs in the deck', async () => {
      const ids = [{ id: 'fc1' }, { id: 'fc2' }];
      mockDecksService.getDeckFlashcards.mockResolvedValue(ids);
      const result = await controller.getDeckFlashcards(
        { id: 'user-1' } as any,
        'd1',
      );
      expect(result).toEqual(ids);
    });

    it('should return empty array when user is null', async () => {
      const result = await controller.getDeckFlashcards(null, 'd1');
      expect(result).toEqual([]);
    });
  });
});
