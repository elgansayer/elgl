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

  describe('updateSrsLevel (SM-2 algorithm)', () => {
    const fakeNow = new Date('2026-07-22T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(fakeNow);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // Helper to create mock card SRS state
    function mockCurrentCard(overrides: Record<string, unknown> = {}) {
      return {
        id: 'card-1',
        user_id: 'user-1',
        word_token: 'bonjour',
        translation: 'hello',
        srs_level: 0,
        easiness_factor: 2.5,
        repetition_count: 0,
        next_review_at: fakeNow.toISOString(),
        ...overrides,
      };
    }

    function expectUpdateCalled(expected: Record<string, unknown>) {
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining(expected),
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'card-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    }

    describe('quality >= 3 (successful recall)', () => {
      it('quality=5, first success: interval=1 day, srs=1, rep=1', async () => {
        // First .single() is for fetching current card
        mockQueryBuilder.single
          .mockResolvedValueOnce({ data: mockCurrentCard(), error: null })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 1 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 5 });

        const nextDate = new Date(fakeNow);
        nextDate.setDate(nextDate.getDate() + 1);

        expectUpdateCalled({
          srs_level: 1,
          easiness_factor: 2.6,
          repetition_count: 1,
          next_review_at: nextDate.toISOString(),
        });
      });

      it('quality=3, first success: interval=1 day, srs=1, rep=1, EF=2.36', async () => {
        mockQueryBuilder.single
          .mockResolvedValueOnce({ data: mockCurrentCard(), error: null })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 1 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 3 });

        const nextDate = new Date(fakeNow);
        nextDate.setDate(nextDate.getDate() + 1);

        // EF = 2.5 + (0.1 - (5-3)*(0.08 + (5-3)*0.02))
        //    = 2.5 + (0.1 - 2 * (0.08 + 2*0.02))
        //    = 2.5 + (0.1 - 2 * 0.12)
        //    = 2.5 + (0.1 - 0.24)
        //    = 2.5 - 0.14
        //    = 2.36
        expectUpdateCalled({
          srs_level: 1,
          easiness_factor: 2.36,
          repetition_count: 1,
          next_review_at: nextDate.toISOString(),
        });
      });

      it('quality=5, second success: interval=6 days, srs=2, rep=2', async () => {
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: mockCurrentCard({ srs_level: 1, repetition_count: 1, easiness_factor: 2.6 }),
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 2 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 5 });

        const nextDate = new Date(fakeNow);
        nextDate.setDate(nextDate.getDate() + 6);

        // EF = 2.6 + 0.1 = 2.7
        expectUpdateCalled({
          srs_level: 2,
          easiness_factor: 2.7,
          repetition_count: 2,
          next_review_at: nextDate.toISOString(),
        });
      });

      it('quality=4, third success with EF=2.5: interval=round(6*2.58)=15 days', async () => {
        // EF = 2.5 + (0.1 - (5-4)*(0.08 + (5-4)*0.02))
        //    = 2.5 + (0.1 - 1*0.10)
        //    = 2.5 - 0.0 = 2.5 ... wait
        //    = 2.5 + 0.1 - 0.10 = 2.5
        // Actually: newEF = 2.5 + (0.1 - 1 * (0.08 + 1*0.02)) = 2.5 + (0.1 - 0.10) = 2.5
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: mockCurrentCard({ srs_level: 2, repetition_count: 2, easiness_factor: 2.5 }),
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 3 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 4 });

        const nextDate = new Date(fakeNow);
        // prevInterval = 6 (level 2 base), newInterval = round(6 * 2.5) = 15
        nextDate.setDate(nextDate.getDate() + 15);

        expectUpdateCalled({
          srs_level: 3,
          easiness_factor: 2.5,
          repetition_count: 3,
          next_review_at: nextDate.toISOString(),
        });
      });
    });

    describe('quality < 3 (failed recall)', () => {
      it('quality=2: resets repetition, interval=1 day, srs decrements', async () => {
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: mockCurrentCard({ srs_level: 2, repetition_count: 2, easiness_factor: 2.7 }),
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 1 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 2 });

        const nextDate = new Date(fakeNow);
        nextDate.setDate(nextDate.getDate() + 1);

        // EF = 2.7 + (0.1 - (5-2)*(0.08 + (5-2)*0.02))
        //    = 2.7 + (0.1 - 3 * (0.08 + 0.06))
        //    = 2.7 + (0.1 - 3 * 0.14)
        //    = 2.7 + (0.1 - 0.42)
        //    = 2.7 - 0.32 = 2.38
        expectUpdateCalled({
          srs_level: 1,
          easiness_factor: 2.38,
          repetition_count: 0,
          next_review_at: nextDate.toISOString(),
        });
      });

      it('quality=0: resets repetition, interval=1 day, srs min 0, EF minimum 1.3', async () => {
        mockQueryBuilder.single
          .mockResolvedValueOnce({
            data: mockCurrentCard({ srs_level: 0, repetition_count: 0, easiness_factor: 1.3 }),
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'card-1', srs_level: 0 },
            error: null,
          });

        await service.updateSrsLevel('user-1', 'card-1', { quality: 0 });

        const nextDate = new Date(fakeNow);
        nextDate.setDate(nextDate.getDate() + 1);

        // EF = 1.3 + (0.1 - 5*(0.08 + 5*0.02))
        //    = 1.3 + (0.1 - 5 * 0.18)
        //    = 1.3 + (0.1 - 0.90)
        //    = 1.3 - 0.80 = 0.5 -> clamped to 1.3
        expectUpdateCalled({
          srs_level: 0,
          easiness_factor: 1.3,
          repetition_count: 0,
          next_review_at: nextDate.toISOString(),
        });
      });
    });

    it('should throw Error when fetch of current card fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Card not found' },
      });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { quality: 3 }),
      ).rejects.toThrow('Failed to update SRS review level: Card not found');
    });

    it('should throw Error when update fails', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: mockCurrentCard(),
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        });

      await expect(
        service.updateSrsLevel('user-1', 'card-1', { quality: 4 }),
      ).rejects.toThrow('Failed to update SRS review level: Database error');
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
    it('should return due cards ordered by next_review_at (no longer filters by srs_level<4)', async () => {
      const cards = [{ id: 'card-1' }];
      mockQueryBuilder.order.mockResolvedValue({
        data: cards,
        error: null,
      });

      const result = await service.getDueReviews('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('flashcards');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      // No longer filters by lt('srs_level', 4) - SM-2 allows reviews at any level
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
