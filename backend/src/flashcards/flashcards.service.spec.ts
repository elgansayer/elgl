import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { SupabaseService } from '../supabase/supabase.service';
import { XpService } from '../xp/xp.service';

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockLogger: any;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Use a factory that returns a fresh builder so call state is clean between tests
    const createQueryBuilder = () => ({
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      then: undefined as any,
    });

    mockQueryBuilder = createQueryBuilder();
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
    it('should return paginated flashcards with default limit', async () => {
      const cards = [{ id: 'card-1' }];

      // count query resolves via .then
      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 5, error: null });

      // data query resolves via .then (range returns this which has .then)
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) => resolve({ data: cards, error: null }),
      });

      const result = await service.getFlashcards('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(result).toEqual({ data: cards, total: 5, limit: 50, offset: 0 });
    });

    it('should filter by level when a valid number is provided', async () => {
      const cards = [{ id: 'card-2', srs_level: 2 }];

      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 1, error: null });
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) => resolve({ data: cards, error: null }),
      });

      const result = await service.getFlashcards('user-1', 2);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('srs_level', 2);
      expect(result.data).toEqual(cards);
    });

    it('should clamp limit to MAX_PAGE_LIMIT', async () => {
      const cards = [{ id: 'card-1' }];

      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 300, error: null });
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) => resolve({ data: cards, error: null }),
      });

      const result = await service.getFlashcards('user-1', undefined, 500);

      // MAX_PAGE_LIMIT is 200
      expect(result.limit).toBe(200);
    });

    it('should return empty data when query errors', async () => {
      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 0, error: null });
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) =>
          resolve({ data: null, error: { message: 'Query error' } }),
      });

      const result = await service.getFlashcards('user-1');
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getDueReviews', () => {
    it('should return paginated due cards ordered by next_review_at', async () => {
      const cards = [{ id: 'card-1' }];

      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 3, error: null });
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) => resolve({ data: cards, error: null }),
      });

      const result = await service.getDueReviews('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.lt).toHaveBeenCalledWith('srs_level', 4);
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
        'next_review_at',
        expect.any(String),
      );
      expect(result.data).toEqual(cards);
      expect(result.total).toBe(3);
    });

    it('should return empty data when getDueReviews query errors', async () => {
      mockQueryBuilder.then = (resolve: any) =>
        resolve({ data: null, count: 0, error: null });
      mockQueryBuilder.range = jest.fn().mockReturnValue({
        then: (resolve: any) =>
          resolve({ data: null, error: { message: 'Error' } }),
      });

      const result = await service.getDueReviews('user-1');
      expect(result.data).toEqual([]);
    });
  });

  describe('getKnownWordsCount', () => {
    it('should return empty set for empty word list', async () => {
      const result = await service.getKnownWordsCount('user-1', []);
      expect(result.size).toBe(0);
    });

    it('should return known words from database', async () => {
      const wordTokens = ['hello', 'world', 'bonjour'];
      mockQueryBuilder.in = jest.fn().mockReturnThis();
      mockQueryBuilder.limit = jest.fn().mockReturnValue({
        then: (resolve: any) =>
          resolve({
            data: [{ word_token: 'hello' }, { word_token: 'bonjour' }],
            error: null,
          }),
      });

      const result = await service.getKnownWordsCount('user-1', wordTokens);

      expect(result.size).toBe(2);
      expect(result.has('hello')).toBe(true);
      expect(result.has('bonjour')).toBe(true);
      expect(result.has('world')).toBe(false);
    });
  });
});
