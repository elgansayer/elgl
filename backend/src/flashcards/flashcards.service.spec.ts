import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: XpService,
          useValue: {
            awardXpForActivity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FlashcardsService>(FlashcardsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrUpdateFlashcard', () => {
    it('should clean word token and upsert flashcard successfully', async () => {
      const dto: any = {
        word_token: '  BONJOUR  ',
        original_context: 'Bonjour le monde',
        translation: 'Hello',
        definition: 'Greeting',
        pronunciation_url: 'http://audio.mock/b.mp3',
      };
      const savedCard: any = { id: 'card-1', word_token: 'bonjour', ...dto };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedCard,
        error: null,
      });

      const result = await service.createOrUpdateFlashcard('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          word_token: 'bonjour',
          original_context: 'Bonjour le monde',
          translation: 'Hello',
          definition: 'Greeting',
          pronunciation_url: 'http://audio.mock/b.mp3',
        },
        { onConflict: 'user_id, word_token' },
      );
      expect(result).toEqual(savedCard);
    });

    it('should throw Error when upsert fails', async () => {
      const dto: any = { word_token: 'test', translation: 'test' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint error' },
      });

      await expect(
        service.createOrUpdateFlashcard('user-1', dto),
      ).rejects.toThrow(
        'Failed to create/update flashcard: Unique constraint error',
      );
    });
  });

  describe('updateSrsLevel', () => {
    const testCases = [
      { level: 0, expectedDays: 1 },
      { level: 1, expectedDays: 3 },
      { level: 2, expectedDays: 7 },
      { level: 3, expectedDays: 14 },
      { level: 4, expectedDays: 30 },
      { level: 5, expectedDays: 1 },
    ];

    testCases.forEach(({ level, expectedDays }) => {
      it(`should calculate next review correctly (+${expectedDays} days) for srs_level ${level}`, async () => {
        const fakeNow = new Date('2026-07-22T12:00:00Z');
        jest.useFakeTimers().setSystemTime(fakeNow);

        const expectedDate = new Date(fakeNow);
        expectedDate.setDate(expectedDate.getDate() + expectedDays);

        const updatedCard = { id: 'card-1', srs_level: level };
        mockQueryBuilder.single.mockResolvedValue({
          data: updatedCard,
          error: null,
        });

        const result = await service.updateSrsLevel('user-1', 'card-1', {
          srs_level: level,
        });

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          srs_level: level,
          next_review_at: expectedDate.toISOString(),
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'card-1');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(result).toEqual(updatedCard);

        jest.useRealTimers();
      });
    });

    it('should throw Error when updateSrsLevel fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Card not found' },
      });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { srs_level: 2 } as any),
      ).rejects.toThrow('Failed to update SRS review level: Card not found');
    });
  });

  describe('getFlashcards', () => {
    it('should query all flashcards for user when level is not specified', async () => {
      const cards = [{ id: 'card-1' }];
      mockQueryBuilder.order.mockResolvedValue({
        data: cards,
        error: null,
      });

      const result = await service.getFlashcards('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(result).toEqual(cards);
    });

    it('should filter by level when a valid number is provided', async () => {
      const cards = [{ id: 'card-2', srs_level: 2 }];
      mockQueryBuilder.eq.mockReturnThis();
      // Since order is called after eq when building, let's make sure our mock returns response when awaited
      // Notice query builds: from().select().eq(user_id).order(). Then if level !== undefined && !isNaN(level), query.eq('srs_level', level).
      // So when query is awaited, it returns whatever eq returns or order returns if eq returns this.
      // Let's set up the promise resolution on queryBuilder itself or mock eq to return a promise when awaited.
      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: cards, error: null });

      const result = await service.getFlashcards('user-1', 2);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('srs_level', 2);
      expect(result).toEqual(cards);
    });

    it('should return empty array when query errors or returns null data', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.getFlashcards('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getDueReviews', () => {
    it('should return due cards ordered by next_review_at', async () => {
      const cards = [{ id: 'card-1' }];
      mockQueryBuilder.order.mockResolvedValue({
        data: cards,
        error: null,
      });

      const result = await service.getDueReviews('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith('srs_level', 4);
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
        'next_review_at',
        expect.any(String),
      );
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('next_review_at', {
        ascending: true,
      });
      expect(result).toEqual(cards);
    });

    it('should return empty array when getDueReviews query errors', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await service.getDueReviews('user-1');
      expect(result).toEqual([]);
    });
  });
});
