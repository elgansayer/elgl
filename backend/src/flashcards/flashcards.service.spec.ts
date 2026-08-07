import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';
import { Flashcard } from './interfaces/flashcard.interface';
import { CreateFlashcardDto } from './dto/flashcard.dto';

// Mock the retry module so we can verify it's being used for SRS operations
jest.mock('../common/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
  isRateLimitError: jest.requireActual('../common/retry').isRateLimitError,
}));

import { withRetry } from '../common/retry';

interface MockLogger {
  info: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  debug: jest.Mock;
}

interface MockQueryBuilder {
  upsert: jest.Mock;
  update: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  then?: jest.Mock;
}

interface MockSupabaseClient {
  from: jest.Mock;
}

interface MockMetricsService {
  recordSrsFlashcardCreated: jest.Mock;
  recordSrsReviewCompleted: jest.Mock;
  setSrsDueCards: jest.Mock;
  setSrsAverageEasinessFactor: jest.Mock;
  setSrsReviewSuccessRate: jest.Mock;
  setSrsCardsPerLevel: jest.Mock;
  setSrsCardsStuck: jest.Mock;
  setSrsDecksTotal: jest.Mock;
  recordSrsDeckCreated: jest.Mock;
}

interface MockRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  keys: jest.Mock;
}

function mockFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    user_id: 'user-1',
    word_token: 'test',
    translation: 'test',
    srs_level: 0,
    easiness_factor: 2.5,
    repetitions: 0,
    interval_days: 0,
    next_review_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockQueryBuilder: MockQueryBuilder;
  let mockLogger: MockLogger;
  let mockMetricsService: MockMetricsService;
  let mockRedisClient: MockRedisClient;

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

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
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
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
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
      const dto: CreateFlashcardDto = {
        word_token: '  BONJOUR  ',
        original_context: 'Bonjour le monde',
        translation: 'Hello',
        definition: 'Greeting',
        pronunciation_url: 'http://audio.mock/b.mp3',
      };
      const savedCard = mockFlashcard({
        word_token: 'bonjour',
        original_context: 'Bonjour le monde',
        translation: 'Hello',
        definition: 'Greeting',
        pronunciation_url: 'http://audio.mock/b.mp3',
      });
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

    it('should throw Error when upsert fails', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'test',
        translation: 'test',
      };
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
        5,
        'pass',
        expect.any(Number),
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

    it('should throw Error when fetch of current card fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Card not found' },
      });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { quality: 3 }),
      ).rejects.toThrow(
        'Failed to fetch flashcard for SRS update: Card not found',
      );
    });

    it('should throw Error when update fails', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { easiness_factor: 2.5, repetitions: 0, interval_days: 0 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Card not found' },
        });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { quality: 3 }),
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
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null }) => void,
      ) => resolve({ data: cards, error: null });

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

  describe('SRS retry integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should wrap createOrUpdateFlashcard Supabase call with withRetry', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'hello',
        translation: 'hola',
      };
      const savedCard = mockFlashcard({ word_token: 'hello' });
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

  describe('Redis cache invalidation', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('getFlashcards caching', () => {
      it('should return cached data from Redis when available', async () => {
        const cachedCards = [mockFlashcard()];
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedCards));

        const result = await service.getFlashcards('user-1');

        expect(mockRedisClient.get).toHaveBeenCalledWith('srs:flashcards:user-1:all');
        expect(result).toEqual(cachedCards);
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      });

      it('should fall through to database when cache is empty, then store result in Redis', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        const dbCards = [mockFlashcard()];
        mockQueryBuilder.order.mockResolvedValue({ data: dbCards, error: null });

        const result = await service.getFlashcards('user-1');

        expect(mockRedisClient.get).toHaveBeenCalledWith('srs:flashcards:user-1:all');
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'srs:flashcards:user-1:all',
          JSON.stringify(dbCards),
          'EX',
          300,
        );
        expect(result).toEqual(dbCards);
      });

      it('should use level-specific cache key when level filter is provided', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        const dbCards = [mockFlashcard({ srs_level: 2 })];
        mockQueryBuilder.then = (resolve: (value: unknown) => void) =>
          resolve({ data: dbCards, error: null });

        await service.getFlashcards('user-1', 2);

        expect(mockRedisClient.get).toHaveBeenCalledWith('srs:flashcards:user-1:2');
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'srs:flashcards:user-1:2',
          JSON.stringify(dbCards),
          'EX',
          300,
        );
      });

      it('should gracefully handle Redis read errors and fall through to database', async () => {
        mockRedisClient.get.mockRejectedValueOnce(new Error('Redis connection error'));
        const dbCards = [mockFlashcard()];
        mockQueryBuilder.order.mockResolvedValue({ data: dbCards, error: null });

        const result = await service.getFlashcards('user-1');

        expect(result).toEqual(dbCards);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should gracefully handle Redis write errors after fetching from database', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        const dbCards = [mockFlashcard()];
        mockQueryBuilder.order.mockResolvedValue({ data: dbCards, error: null });
        mockRedisClient.set.mockRejectedValueOnce(new Error('Redis write error'));

        const result = await service.getFlashcards('user-1');

        expect(result).toEqual(dbCards);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe('getDueReviews caching', () => {
      it('should return cached due reviews from Redis when available', async () => {
        const cachedDue = [mockFlashcard({ srs_level: 1 })];
        mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cachedDue));

        const result = await service.getDueReviews('user-1');

        expect(mockRedisClient.get).toHaveBeenCalledWith('srs:due:user-1');
        expect(result).toEqual(cachedDue);
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      });

      it('should fall through to database and cache with shorter TTL for due reviews', async () => {
        mockRedisClient.get.mockResolvedValueOnce(null);
        const dbDue = [mockFlashcard({ srs_level: 0 })];
        mockQueryBuilder.order.mockResolvedValue({ data: dbDue, error: null });

        const result = await service.getDueReviews('user-1');

        expect(mockRedisClient.get).toHaveBeenCalledWith('srs:due:user-1');
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          'srs:due:user-1',
          JSON.stringify(dbDue),
          'EX',
          120,
        );
        expect(result).toEqual(dbDue);
      });
    });

    describe('cache invalidation on mutations', () => {
      it('should invalidate flashcard caches and due reviews on createOrUpdateFlashcard', async () => {
        const dto = { word_token: 'new', translation: 'nuevo' } as CreateFlashcardDto;
        const savedCard = mockFlashcard({ id: 'card-new', word_token: 'new' });
        mockQueryBuilder.single.mockResolvedValue({ data: savedCard, error: null });
        mockRedisClient.keys.mockResolvedValueOnce([
          'srs:flashcards:user-1:all',
          'srs:flashcards:user-1:0',
        ]);

        await service.createOrUpdateFlashcard('user-1', dto);

        expect(mockRedisClient.keys).toHaveBeenCalledWith('srs:flashcards:user-1:*');
        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'srs:flashcards:user-1:all',
          'srs:flashcards:user-1:0',
        );
        expect(mockRedisClient.del).toHaveBeenCalledWith('srs:due:user-1');
      });

      it('should invalidate caches on updateSrsLevel', async () => {
        const currentCard = { easiness_factor: 2.5, repetitions: 0, interval_days: 0 };
        const updatedCard = mockFlashcard({ srs_level: 1, easiness_factor: 2.6, repetitions: 1, interval_days: 1 });
        mockQueryBuilder.single
          .mockResolvedValueOnce({ data: currentCard, error: null })
          .mockResolvedValueOnce({ data: updatedCard, error: null });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 5 });

        expect(mockRedisClient.del).toHaveBeenCalledWith('srs:due:user-1');
        expect(mockRedisClient.keys).toHaveBeenCalledWith('srs:flashcards:user-1:*');
      });

      it('should gracefully handle Redis errors during invalidation', async () => {
        const dto = { word_token: 'new', translation: 'nuevo' } as CreateFlashcardDto;
        const savedCard = mockFlashcard({ id: 'card-new', word_token: 'new' });
        mockQueryBuilder.single.mockResolvedValue({ data: savedCard, error: null });
        mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis unavailable'));

        await service.createOrUpdateFlashcard('user-1', dto);

        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe('invalidateSrsCacheForUser', () => {
      it('should invalidate both flashcard lists and due reviews', async () => {
        mockRedisClient.keys.mockResolvedValueOnce([
          'srs:flashcards:user-1:all',
          'srs:flashcards:user-1:2',
        ]);

        await service.invalidateSrsCacheForUser('user-1');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('srs:flashcards:user-1:*');
        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'srs:flashcards:user-1:all',
          'srs:flashcards:user-1:2',
        );
        expect(mockRedisClient.del).toHaveBeenCalledWith('srs:due:user-1');
      });
    });
  });
});
