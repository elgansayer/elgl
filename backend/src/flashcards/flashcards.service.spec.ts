import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';
import { CloudflareCacheService } from '../cloudflare/cache.service';
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

interface MockRedisClient {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
}

interface MockQueryBuilder {
  upsert: jest.Mock;
  update: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
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

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    mockQueryBuilder = {
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
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
        {
          provide: CloudflareCacheService,
          useValue: { purgeByCacheTags: jest.fn().mockResolvedValue(true) },
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
    it('should clean word token, upsert flashcard, and invalidate Redis caches', async () => {
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
      // Verify Redis invalidation was called
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:list:user-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:due:user-1');
      expect(mockMetricsService.recordSrsFlashcardCreated).toHaveBeenCalled();
      expect(result).toEqual(savedCard);
    });

    it('should throw Error when upsert fails (no cache invalidation)', async () => {
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
      // Redis invalidation should NOT be called on error
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('updateSrsLevel', () => {
    const fakeNow = new Date('2026-07-22T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(fakeNow);
      mockRedisClient.del.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fetch current card, apply SM-2, and invalidate Redis caches', async () => {
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
      // Verify Redis cache invalidation on successful SRS update
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:list:user-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:due:user-1');
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
      // Verify Redis invalidation
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:list:user-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('flashcards:due:user-1');
    });

    it('should reset repetitions on quality < 3 (failed recall) and invalidate caches', async () => {
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
      // Redis invalidation still called for failures (SRS level changed)
      expect(mockRedisClient.del).toHaveBeenCalled();
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

    it('should throw Error when fetch of current card fails (no cache invalidation)', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Card not found' },
      });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { quality: 3 }),
      ).rejects.toThrow(
        'Failed to fetch flashcard for SRS update: Card not found',
      );
      // Redis invalidation should NOT be called on error
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should throw Error when update fails (no cache invalidation)', async () => {
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
      // Redis invalidation should NOT be called on error
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('getFlashcards', () => {
    it('should return cached data when Redis cache is available for first page', async () => {
      const cards = [{ id: 'cached-card-1' }];
      const cachedPayload = { data: cards, total: 1 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getFlashcards('user-1');

      expect(mockRedisClient.get).toHaveBeenCalledWith('flashcards:list:user-1');
      // Should NOT hit the database when cache is fresh
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(result).toEqual(cachedPayload);
    });

    it('should query DB and cache result when Redis is empty', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const cards = [{ id: 'card-1' }];
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 1 });

      const result = await service.getFlashcards('user-1');

      expect(mockRedisClient.get).toHaveBeenCalledWith('flashcards:list:user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
      // Should cache the paginated result
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'flashcards:list:user-1',
        JSON.stringify({ data: cards, total: 1 }),
        'EX',
        300,
      );
      expect(result).toEqual({ data: cards, total: 1 });
    });

    it('should query DB and fall back when Redis cache parse fails', async () => {
      mockRedisClient.get.mockResolvedValue('invalid-json{{{');

      const cards = [{ id: 'card-fallback' }];
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 1 });

      const result = await service.getFlashcards('user-1');

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(result).toEqual({ data: cards, total: 1 });
    });

    it('should filter by level with level-specific cache key', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const cards = [{ id: 'card-2', srs_level: 2 }];
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 1 });

      const result = await service.getFlashcards('user-1', 2);

      expect(mockRedisClient.get).toHaveBeenCalledWith('flashcards:list:user-1:level:2');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('srs_level', 2);
      // Should use the level-specific cache key for storing
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'flashcards:list:user-1:level:2',
        JSON.stringify({ data: cards, total: 1 }),
        'EX',
        300,
      );
      expect(result).toEqual({ data: cards, total: 1 });
    });

    it('should return empty data when DB query errors and cache is empty', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: null; error: { message: string }; count: null }) => void,
      ) => resolve({ data: null, error: { message: 'Query error' }, count: null });

      const result = await service.getFlashcards('user-1');
      expect(result).toEqual({ data: [], total: 0 });
      // Should not try to cache error results
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should skip cache for non-default pagination (offset > 0)', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const cards = [{ id: 'card-page-2' }];
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 10 });

      const result = await service.getFlashcards('user-1', undefined, 100, 100);

      // Should NOT check Redis for non-first page
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(100, 199);
      // Should NOT cache non-first page results
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(result).toEqual({ data: cards, total: 10 });
    });
  });

  describe('getDueReviews', () => {
    it('should return cached data when Redis cache is available', async () => {
      const cards = [{ id: 'cached-due-1' }];
      const cachedPayload = { data: cards, total: 1 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getDueReviews('user-1');

      expect(mockRedisClient.get).toHaveBeenCalledWith('flashcards:due:user-1');
      // Should NOT hit the database
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(result).toEqual(cachedPayload);
    });

    it('should query DB and cache result when Redis is empty', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const cards = [{ id: 'card-1' }];
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 1 });

      const result = await service.getDueReviews('user-1');

      expect(mockRedisClient.get).toHaveBeenCalledWith('flashcards:due:user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith('srs_level', 4);
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
        'next_review_at',
        expect.any(String),
      );
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 99);
      // Should cache with 60s TTL
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'flashcards:due:user-1',
        JSON.stringify({ data: cards, total: 1 }),
        'EX',
        60,
      );
      expect(result).toEqual({ data: cards, total: 1 });
    });

    it('should return empty data when DB query errors and cache empty', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: null; error: { message: string }; count: null }) => void,
      ) => resolve({ data: null, error: { message: 'Error' }, count: null });

      const result = await service.getDueReviews('user-1');
      expect(result).toEqual({ data: [], total: 0 });
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should skip cache for non-default pagination (offset > 0)', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const cards = [{ id: 'card-page-2' }];
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: cards, error: null, count: 10 });

      const result = await service.getDueReviews('user-1', 100, 100);

      // Should NOT check Redis cache for non-first page
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(100, 199);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(result).toEqual({ data: cards, total: 10 });
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
      mockRedisClient.get.mockResolvedValue(null);
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: [], error: null, count: 0 });

      await service.getFlashcards('user-1');

      expect(withRetry).not.toHaveBeenCalled();
    });

    it('should not wrap getDueReviews with withRetry', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockQueryBuilder.range.mockReturnThis();
      mockQueryBuilder.then = (
        resolve: (value: { data: unknown[]; error: null; count: number }) => void,
      ) => resolve({ data: [], error: null, count: 0 });

      await service.getDueReviews('user-1');

      expect(withRetry).not.toHaveBeenCalled();
    });
  });
});
