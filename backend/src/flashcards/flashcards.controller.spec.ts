import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
<<<<<<< HEAD
import { CACHE_PRIVATE_NO_STORE, CACHE_PRIVATE_SHORT } from '../common/cache';
=======
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';
>>>>>>> origin/main

describe('FlashcardsController', () => {
  let controller: FlashcardsController;
  let flashcardsService: FlashcardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashcardsController],
      providers: [
        {
          provide: FlashcardsService,
          useValue: {
            createOrUpdateFlashcard: jest.fn(),
            updateSrsLevel: jest.fn(),
            getFlashcards: jest.fn(),
            getDueReviews: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(SrsRateLimiterGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<FlashcardsController>(FlashcardsController);
    flashcardsService = module.get<FlashcardsService>(FlashcardsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createFlashcard', () => {
    it('should return null if user is not provided', async () => {
      const dto = {
        word_token: 'bonjour',
        translation: 'hello',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.createFlashcard(null, dto as any);
      expect(result).toBeNull();
      expect(flashcardsService.createOrUpdateFlashcard).not.toHaveBeenCalled();
    });

    it('should call service createOrUpdateFlashcard when user is provided', async () => {
      const dto = {
        word_token: 'bonjour',
        translation: 'hello',
      };
      const card = { id: 'card-1', ...dto };
      (flashcardsService.createOrUpdateFlashcard as jest.Mock).mockResolvedValue(
        card,
      );

      const result = await controller.createFlashcard(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'user-1' } as any,
        dto,
      );
      expect(flashcardsService.createOrUpdateFlashcard).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(card);
    });
  });

  describe('updateSrs', () => {
    it('should return null if user is not provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await controller.updateSrs(null, 'card-1', {} as any);
      expect(result).toBeNull();
      expect(flashcardsService.updateSrsLevel).not.toHaveBeenCalled();
    });

    it('should call service updateSrsLevel when user is provided', async () => {
      const dto = { quality: 4 };
      const card = { id: 'card-1', srs_level: 2 };
      (flashcardsService.updateSrsLevel as jest.Mock).mockResolvedValue(card);

      const result = await controller.updateSrs(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'user-1' } as any,
        'card-1',
        dto,
      );
      expect(flashcardsService.updateSrsLevel).toHaveBeenCalledWith(
        'user-1',
        'card-1',
        dto,
      );
      expect(result).toEqual(card);
    });
  });

  describe('getFlashcards', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getFlashcards(null);
      expect(result).toEqual([]);
      expect(flashcardsService.getFlashcards).not.toHaveBeenCalled();
    });

    it('should call service getFlashcards with parsed integer level', async () => {
      const cards = [{ id: 'card-1' }];
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getFlashcards(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'user-1' } as any,
        '3',
      );
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith('user-1', 3);
      expect(result).toEqual(cards);
    });

    it('should call service getFlashcards with undefined level when not provided', async () => {
      const cards = [{ id: 'card-1' }];
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getFlashcards(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'user-1' } as any,
      );
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith(
        'user-1',
        undefined,
      );
      expect(result).toEqual(cards);
    });
  });

  describe('getDueReviews', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getDueReviews(null);
      expect(result).toEqual([]);
      expect(flashcardsService.getDueReviews).not.toHaveBeenCalled();
    });

    it('should call service getDueReviews when user is provided', async () => {
      const cards = [{ id: 'card-due' }];
      (flashcardsService.getDueReviews as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getDueReviews(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'user-1' } as any,
      );
      expect(flashcardsService.getDueReviews).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(cards);
    });
  });

  describe('cache headers', () => {
    it('CACHE_PRIVATE_NO_STORE should forbid CDN and browser caching', () => {
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toContain('no-store');
    });

    it('CACHE_PRIVATE_SHORT should allow brief browser cache but forbid CDN', () => {
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=60');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('no-store');
    });
  });
});
