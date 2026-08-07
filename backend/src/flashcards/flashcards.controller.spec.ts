import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { User } from '@supabase/supabase-js';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import { Flashcard, SrsHealthStatus } from './interfaces/flashcard.interface';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';

function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
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

function mockResponse(): Partial<Response> {
  return {
    header: jest.fn(),
  };
}

describe('FlashcardsController', () => {
  let controller: FlashcardsController;
  let flashcardsService: jest.Mocked<Partial<FlashcardsService>>;

  beforeEach(async () => {
    flashcardsService = {
      getHealthStatus: jest.fn(),
      createOrUpdateFlashcard: jest.fn(),
      updateSrsLevel: jest.fn(),
      getFlashcards: jest.fn(),
      getDueReviews: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlashcardsController],
      providers: [
        {
          provide: FlashcardsService,
          useValue: flashcardsService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(SrsRateLimiterGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<FlashcardsController>(FlashcardsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status from service', () => {
      const health: SrsHealthStatus = {
        healthy: true,
        mode: 'full',
        degradedServices: [],
        lastSuccessfulSync: null,
        cacheStats: { cachedFlashcardCount: 0, pendingSyncCount: 0 },
      };
      flashcardsService.getHealthStatus = jest.fn().mockReturnValue(health);

      const result = controller.getHealth();
      expect(result).toEqual(health);
      expect(flashcardsService.getHealthStatus).toHaveBeenCalled();
    });
  });

  describe('createFlashcard', () => {
    it('should return null if user is not provided', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'bonjour',
        translation: 'hello',
      };
      const result = await controller.createFlashcard(null, dto);
      expect(result).toBeNull();
      expect(flashcardsService.createOrUpdateFlashcard).not.toHaveBeenCalled();
    });

    it('should call service createOrUpdateFlashcard when user is provided', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'bonjour',
        translation: 'hello',
      };
      const card = mockFlashcard({
        word_token: 'bonjour',
        translation: 'hello',
      });
      flashcardsService.createOrUpdateFlashcard = jest.fn().mockResolvedValue(card);

      const res = mockResponse();
      const result = await controller.createFlashcard(
        mockUser(),
        dto,
        res as Response,
      );
      expect(flashcardsService.createOrUpdateFlashcard).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(flashcardsService.purgeSrsCache).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(card);
      expect(res.header).not.toHaveBeenCalledWith('X-SRS-Degraded', 'true');
    });

    it('should set X-SRS-Degraded header when flashcard is degraded', async () => {
      const dto: CreateFlashcardDto = {
        word_token: 'test',
        translation: 'test',
      };
      const degradedCard = mockFlashcard({ degraded: true });
      flashcardsService.createOrUpdateFlashcard = jest.fn().mockResolvedValue(degradedCard);

      const res = mockResponse();
      await controller.createFlashcard(mockUser(), dto, res as Response);
      expect(res.header).toHaveBeenCalledWith('X-SRS-Degraded', 'true');
    });
  });

  describe('updateSrs', () => {
    it('should return null if user is not provided', async () => {
      const dto: UpdateSrsDto = { quality: 0 };
      const result = await controller.updateSrs(null, 'card-1', dto);
      expect(result).toBeNull();
      expect(flashcardsService.updateSrsLevel).not.toHaveBeenCalled();
    });

    it('should call service updateSrsLevel when user is provided', async () => {
      const dto: UpdateSrsDto = { quality: 4 };
      const card = mockFlashcard({ id: 'card-1', srs_level: 2 });
      flashcardsService.updateSrsLevel = jest.fn().mockResolvedValue(card);

      const res = mockResponse();
      const result = await controller.updateSrs(
        mockUser(),
        'card-1',
        dto,
        res as Response,
      );
      expect(flashcardsService.updateSrsLevel).toHaveBeenCalledWith(
        'user-1',
        'card-1',
        dto,
      );
      expect(result).toEqual(card);
    });

    it('should set X-SRS-Degraded header when result is degraded', async () => {
      const dto: UpdateSrsDto = { quality: 3 };
      const degradedCard = mockFlashcard({ id: 'card-1', degraded: true });
      flashcardsService.updateSrsLevel = jest.fn().mockResolvedValue(degradedCard);

      const res = mockResponse();
      await controller.updateSrs(mockUser(), 'card-1', dto, res as Response);
      expect(res.header).toHaveBeenCalledWith('X-SRS-Degraded', 'true');
    });
  });

  describe('getFlashcards', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getFlashcards(null);
      expect(result).toEqual([]);
      expect(flashcardsService.getFlashcards).not.toHaveBeenCalled();
    });

    it('should call service getFlashcards with parsed integer level', async () => {
      const cards: Flashcard[] = [mockFlashcard()];
      flashcardsService.getFlashcards = jest.fn().mockResolvedValue(cards);

      const res = mockResponse();
      const result = await controller.getFlashcards(mockUser(), '3', res as Response);
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith('user-1', 3);
      expect(result).toEqual(cards);
    });

    it('should set X-SRS-Degraded header when any card is degraded', async () => {
      const cards: Flashcard[] = [
        mockFlashcard({ id: 'ok' }),
        mockFlashcard({ id: 'degraded-one', degraded: true }),
      ];
      flashcardsService.getFlashcards = jest.fn().mockResolvedValue(cards);

      const res = mockResponse();
      await controller.getFlashcards(mockUser(), undefined, res as Response);
      expect(res.header).toHaveBeenCalledWith('X-SRS-Degraded', 'true');
    });
  });

  describe('getDueReviews', () => {
    it('should return empty array if user is not provided', async () => {
      const result = await controller.getDueReviews(null);
      expect(result).toEqual([]);
      expect(flashcardsService.getDueReviews).not.toHaveBeenCalled();
    });

    it('should call service getDueReviews when user is provided', async () => {
      const cards: Flashcard[] = [mockFlashcard({ id: 'card-due' })];
      flashcardsService.getDueReviews = jest.fn().mockResolvedValue(cards);

      const res = mockResponse();
      const result = await controller.getDueReviews(mockUser(), res as Response);
      expect(flashcardsService.getDueReviews).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(cards);
    });
  });
});
