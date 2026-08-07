import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';
import { MetricsService } from '../metrics/metrics.service';
<<<<<<< HEAD
import { Flashcard, SrsHealthStatus } from './interfaces/flashcard.interface';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
=======
import { CloudflareCacheService } from '../cloudflare/cache.service';
import { Flashcard } from './interfaces/flashcard.interface';
import { CreateFlashcardDto } from './dto/flashcard.dto';
>>>>>>> origin/main

jest.mock('../common/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
  isRateLimitError: jest.requireActual('../common/retry').isRateLimitError,
}));

import { withRetry, isRateLimitError } from '../common/retry';

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

  describe('getHealthStatus', () => {
    it('should report healthy with full mode when no degraded operations', () => {
      const status = service.getHealthStatus();
      expect(status.healthy).toBe(true);
      expect(status.mode).toBe('full');
      expect(status.degradedServices).toEqual([]);
    });
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

    it('should throw Error when upsert fails with non-connectivity error', async () => {
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

    it('should return degraded flashcard when connectivity error occurs', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'bonjour',
        translation: 'hello',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'fetch failed', code: 'FETCH_ERROR' },
      });

      const result = await service.createOrUpdateFlashcard('user-1', dto);
      expect(result.degraded).toBe(true);
      expect(result.word_token).toBe('bonjour');
      expect(result.translation).toBe('hello');
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

    it('should throw Error when fetch of current card fails with non-connectivity error', async () => {
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

    it('should throw Error when update fails with non-connectivity error', async () => {
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

    it('should return degraded card when fetch fails with connectivity error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'fetch failed', code: 'FETCH_ERROR' },
      });

      // The update will also fail -- second single call
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'fetch failed', code: 'FETCH_ERROR' },
      });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 5,
      });

      expect(result.degraded).toBe(true);
      expect(result.srs_level).toBe(1); // SM-2 defaults: quality 5 => first review
      expect(result.easiness_factor).toBe(2.6);
      expect(result.interval_days).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return degraded card when update fails with connectivity error', async () => {
      const currentCard = {
        easiness_factor: 2.5,
        repetitions: 2,
        interval_days: 6,
      };
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: currentCard, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'network error' },
        });

      const result = await service.updateSrsLevel('user-1', 'card-1', {
        quality: 4,
      });

      expect(result.degraded).toBe(true);
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

    it('should fall back to memory store when connectivity error occurs', async () => {
      mockQueryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'fetch failed' },
      });

      const result = await service.getFlashcards('user-1');
      expect(result).toEqual([]);
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

    it('should wrap updateSrsLevel calls with withRetry', async () => {
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

      expect(withRetry).toHaveBeenCalledTimes(2);
    });
  });

  describe('SM-2 algorithm edge cases', () => {
    it('handleRepetitionOne should set interval 6', () => {
      const result = service.applySm2Algorithm(4, 2.5, 1, 1);
      expect(result.newInterval).toBe(6);
      expect(result.newRepetitions).toBe(2);
    });

    it('handleRepetitionTwoPlus should multiply interval by EF', () => {
      const result = service.applySm2Algorithm(4, 2.5, 2, 6);
      expect(result.newInterval).toBe(15); // 6 * 2.5 = 15
      expect(result.newRepetitions).toBe(3);
    });

    it('should derive level 2 for exactly 2 repetitions', () => {
      const result = service.applySm2Algorithm(4, 2.5, 1, 1);
      expect(result.newRepetitions).toBe(2);
      expect(result.newSrsLevel).toBe(2);
    });

    it('should derive level 3 for interval < 21', () => {
      const result = service.applySm2Algorithm(4, 2.5, 2, 1);
      expect(result.newRepetitions).toBe(3);
      expect(result.newSrsLevel).toBe(3);
    });

    it('should derive level 4 for interval >= 21', () => {
      const result = service.applySm2Algorithm(5, 3.0, 2, 7);
      expect(result.newSrsLevel).toBe(4);
    });
  });
});
