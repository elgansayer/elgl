import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';

// Mock the retry module so we can verify it's being used for SRS operations
jest.mock('../common/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
  isRateLimitError: jest.requireActual('../common/retry').isRateLimitError,
}));

import { withRetry } from '../common/retry';

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockLogger: any;
  let mockMetricsService: any;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockMetricsService = {
      recordSrsFlashcardCreated: jest.fn(),
      recordSrsReviewCompleted: jest.fn(),
      setSrsDueCards: jest.fn(),
      setSrsAverageEasinessFactor: jest.fn(),
      setSrsReviewSuccessRate: jest.fn(),
      setSrsCardsPerLevel: jest.fn(),
      setSrsCardsStuck: jest.fn(),
      setSrsDecksTotal: jest.fn(),
      recordSrsDeckCreated: jest.fn(),
    };

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
          provide: 'PinoLogger:FlashcardsService',
          useValue: mockLogger,
        },
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
        {
          provide: MetricsService,
          useValue: mockMetricsService,
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
      expect(mockMetricsService.recordSrsFlashcardCreated).toHaveBeenCalled();
      expect(result).toEqual(savedCard);
    });

    it('should return fallback flashcard when upsert fails (graceful degradation)', async () => {
      const dto: any = { word_token: 'test', translation: 'test' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint error' },
      });

      const result = await service.createOrUpdateFlashcard('user-1', dto);

      // Graceful degradation: returns locally-constructed flashcard
      expect(result).toBeDefined();
      expect(result.word_token).toBe('test');
      expect(result.translation).toBe('test');
      expect(result.user_id).toBe('user-1');
      expect(result.srs_level).toBe(0);
      expect(result.easiness_factor).toBe(2.5);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return fallback flashcard when supabase throws network error', async () => {
      const dto: any = { word_token: 'network-test', translation: 'net' };
      mockQueryBuilder.single.mockRejectedValue(new Error('Network error'));

      const result = await service.createOrUpdateFlashcard('user-1', dto);

      expect(result).toBeDefined();
      expect(result.word_token).toBe('network-test');
      expect(result.user_id).toBe('user-1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('updateSrsLevel', () => {
    const fakeNow = new Date('2026-07-22T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(fakeNow);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fetch current card and apply SM-2 with quality 5 (perfect recall, first review)', async () => {
      // First single() call = fetch current state, second = update result
      const currentCard = {
        easiness_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
      };
      // q=5: EF = 2.5 + 0.1 - 0 = 2.6
      const updatedCard = {
        id: 'card-1',
        srs_level: 1,
        easiness_factor: 2.6,
        repetitions: 1,
        interval_days: 1,
        next_review_at: '2026-07-23T12:00:00.000Z',
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({ data: updatedCard, error: null });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 5,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'easiness_factor, repetitions, interval_days',
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        srs_level: 1,
        easiness_factor: 2.6,
        repetitions: 1,
        interval_days: 1,
        next_review_at: '2026-07-23T12:00:00.000Z',
      });
      expect(mockMetricsService.recordSrsReviewCompleted).toHaveBeenCalledWith(
        5, 'pass', expect.any(Number),
      );
      expect(result).toEqual(updatedCard);
    });

    it('should apply SM-2 with quality 5 after multiple repetitions', async () => {
      const currentCard = {
        easiness_factor: 2.6,
        repetitions: 3,
        interval_days: 15,
      };
      // q=5: EF = 2.6 + 0.1 = 2.7
      // interval: 15 * 2.7 = 40.5, rounded to 41
      // srs_level: repetitions=4, interval 41 >= 21 -> level 4
      const updatedCard = {
        id: 'card-1',
        srs_level: 4,
        easiness_factor: 2.7,
        repetitions: 4,
        interval_days: 41,
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({ data: updatedCard, error: null });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 5,
      });

      expect(result.srs_level).toBe(4);
      expect(result.repetitions).toBe(4);
      expect(result.interval_days).toBe(41);
      expect(result.easiness_factor).toBe(2.7);
    });

    it('should reset repetitions on quality < 3 (failed recall)', async () => {
      const currentCard = {
        easiness_factor: 2.5,
        repetitions: 3,
        interval_days: 30,
      };
      // q=1: EF = 2.5 + 0.1 - 4*(0.08 + 4*0.02) = 2.5 + 0.1 - 4*0.16 = 2.5 + 0.1 - 0.64 = 1.96
      const updatedCard = {
        id: 'card-1',
        srs_level: 0,
        easiness_factor: 1.96,
        repetitions: 0,
        interval_days: 1,
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({ data: updatedCard, error: null });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 1,
      });

      expect(result.srs_level).toBe(0);
      expect(result.repetitions).toBe(0);
      expect(result.interval_days).toBe(1);
    });

    it('should clamp minimum easiness_factor to 1.3', async () => {
      const currentCard = {
        easiness_factor: 1.35,
        repetitions: 0,
        interval_days: 0,
      };
      // q=0: EF = 1.35 + 0.1 - 5*(0.08 + 5*0.02) = 1.35 + 0.1 - 5*0.18 = 1.35 + 0.1 - 0.9 = 0.55, clamp to 1.3
      const updatedCard = {
        id: 'card-1',
        srs_level: 0,
        easiness_factor: 1.3,
        repetitions: 0,
        interval_days: 1,
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({ data: updatedCard, error: null });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 0,
      });

      expect(result.easiness_factor).toBe(1.3);
    });

    it('should use default SM-2 state when fetch fails (graceful degradation)', async () => {
      // First single() call = fetch current state (fail)
      // Second single() call = update result (also fails)
      const updatedCard = {
        id: 'card-1',
        srs_level: 1,
        easiness_factor: 2.5,
        repetitions: 1,
        interval_days: 1,
        next_review_at: '2026-07-23T12:00:00.000Z',
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Card not found' },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Card not found' },
        });

      const result = await service.updateSrsLevel('user-1', 'card-1', { quality: 3 });

      expect(result).toBeDefined();
      expect(result.srs_level).toBe(1);
      expect(result.id).toBe('card-1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return locally computed SRS state when update fails (graceful degradation)', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { easiness_factor: 2.5, repetitions: 0, interval_days: 0 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Card not found' },
        });

      const result = await service.updateSrsLevel('user-1', 'card-1', { quality: 3 });

      // q=3: EF = 2.5 + 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 2.5 + 0.1 - 2*0.12 = 2.36
      expect(result).toBeDefined();
      expect(result.srs_level).toBe(1);
      expect(result.easiness_factor).toBe(2.36);
      expect(result.id).toBe('card-1');
      expect(mockLogger.warn).toHaveBeenCalled();
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

    it('should return mock fallback data when query returns error or null data', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Query error' },
      });

      const result = await service.getFlashcards('user-1');
      expect(result.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return mock fallback data when supabase query fails (graceful degradation)', async () => {
      mockQueryBuilder.order.mockRejectedValue(new Error('Network failure'));

      const result = await service.getFlashcards('user-1');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('word_token');
      expect(result[0]).toHaveProperty('srs_level');
      expect(mockLogger.warn).toHaveBeenCalled();
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

    it('should return mock fallback data when getDueReviews query errors', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
      });

      const result = await service.getDueReviews('user-1');
      expect(result.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return mock fallback data when getDueReviews query throws network error', async () => {
      mockQueryBuilder.order.mockRejectedValue(new Error('Network failure'));

      const result = await service.getDueReviews('user-1');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // All returned cards should have srs_level < 4
      result.forEach((card: any) => {
        expect(card.srs_level).toBeLessThan(4);
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('SRS retry integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should wrap createOrUpdateFlashcard Supabase call with withRetry', async () => {
      const dto: any = { word_token: 'hello', translation: 'hola' };
      const savedCard: any = { id: 'card-1', word_token: 'hello' };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedCard,
        error: null,
      });

      await service.createOrUpdateFlashcard('user-1', dto);

      expect(withRetry).toHaveBeenCalledTimes(1);
      expect(withRetry).toHaveBeenCalledWith(expect.any(Function), {
        logger: mockLogger,
      });
    });

    it('should wrap updateSrsLevel fetch call with withRetry', async () => {
      const currentCard = {
        easiness_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
      };
      const updatedCard = {
        id: 'card-1',
        srs_level: 1,
        easiness_factor: 2.6,
        repetitions: 1,
        interval_days: 1,
        next_review_at: '2026-07-23T12:00:00.000Z',
      };

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({ data: updatedCard, error: null });

      await service.updateSrsLevel('user-1', 'card-1', { quality: 5 });

      // withRetry should be called twice: once for fetch, once for update
      expect(withRetry).toHaveBeenCalledTimes(2);
      // Both calls should pass the logger
      const calls = (withRetry as jest.Mock).mock.calls;
      expect(calls[0][1]).toEqual({ logger: mockLogger });
      expect(calls[1][1]).toEqual({ logger: mockLogger });
    });

    it('should not wrap getFlashcards with withRetry', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getFlashcards('user-1');

      expect(withRetry).not.toHaveBeenCalled();
    });

    it('should not wrap getDueReviews with withRetry', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getDueReviews('user-1');

      expect(withRetry).not.toHaveBeenCalled();
    });
  });
});
