import { Test, TestingModule } from '@nestjs/testing';

// Mock jsdom and dompurify to avoid parsing ESM dependencies (transitively imported via FlashcardsService)
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: { createElement: jest.fn(), createDocumentFragment: jest.fn() },
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));
jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string) => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: jest.fn(),
  })),
}));

import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';
import { Flashcard } from './interfaces/flashcard.interface';
import { CreateFlashcardDto, UpdateSrsDto } from './dto/flashcard.dto';
import { User } from '@supabase/supabase-js';

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
      (
        flashcardsService.createOrUpdateFlashcard as jest.Mock
      ).mockResolvedValue(card);

      const result = await controller.createFlashcard(mockUser(), dto);
      expect(flashcardsService.createOrUpdateFlashcard).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(card);
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
      (flashcardsService.updateSrsLevel as jest.Mock).mockResolvedValue(card);

      const result = await controller.updateSrs(mockUser(), 'card-1', dto);
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
      const cards: Flashcard[] = [mockFlashcard()];
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getFlashcards(mockUser(), '3');
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith('user-1', 3);
      expect(result).toEqual(cards);
    });

    it('should call service getFlashcards with undefined level when not provided', async () => {
      const cards: Flashcard[] = [mockFlashcard()];
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getFlashcards(mockUser());
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
      const cards: Flashcard[] = [mockFlashcard({ id: 'card-due' })];
      (flashcardsService.getDueReviews as jest.Mock).mockResolvedValue(cards);

      const result = await controller.getDueReviews(mockUser());
      expect(flashcardsService.getDueReviews).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(cards);
    });
  });
});
