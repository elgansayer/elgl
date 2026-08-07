import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PaginatedResponse } from './interfaces/flashcard.interface';

describe('FlashcardsController', () => {
  let controller: FlashcardsController;
  let flashcardsService: FlashcardsService;

  const emptyPaginated: PaginatedResponse<unknown> = {
    data: [],
    total: 0,
    limit: 50,
    offset: 0,
  };

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
      const result = await controller.createFlashcard(null, {} as any);
      expect(result).toBeNull();
      expect(flashcardsService.createOrUpdateFlashcard).not.toHaveBeenCalled();
    });

    it('should call service createOrUpdateFlashcard when user is provided', async () => {
      const dto: any = { word_token: 'bonjour', translation: 'hello' };
      const card: any = { id: 'card-1', ...dto };
      (
        flashcardsService.createOrUpdateFlashcard as jest.Mock
      ).mockResolvedValue(card);

      const result = await controller.createFlashcard(
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
      const result = await controller.updateSrs(null, 'card-1', {} as any);
      expect(result).toBeNull();
      expect(flashcardsService.updateSrsLevel).not.toHaveBeenCalled();
    });

    it('should call service updateSrsLevel when user is provided', async () => {
      const dto: any = { quality: 4 };
      const card: any = { id: 'card-1', srs_level: 2 };
      (flashcardsService.updateSrsLevel as jest.Mock).mockResolvedValue(card);

      const result = await controller.updateSrs(
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
    it('should return empty paginated response if user is not provided', async () => {
      const result = await controller.getFlashcards(null);
      expect(result).toEqual(emptyPaginated);
      expect(flashcardsService.getFlashcards).not.toHaveBeenCalled();
    });

    it('should call service getFlashcards with parsed params', async () => {
      const cards: any[] = [{ id: 'card-1' }];
      const paged: PaginatedResponse<unknown> = {
        data: cards,
        total: 1,
        limit: 50,
        offset: 0,
      };
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(paged);

      const result = await controller.getFlashcards(
        { id: 'user-1' } as any,
        '3',
        '25',
        '10',
      );
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith(
        'user-1',
        3,
        25,
        10,
      );
      expect(result).toEqual(paged);
    });

    it('should call service getFlashcards with undefined optional params', async () => {
      const paged: PaginatedResponse<unknown> = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
      (flashcardsService.getFlashcards as jest.Mock).mockResolvedValue(paged);

      const result = await controller.getFlashcards({ id: 'user-1' } as any);
      expect(flashcardsService.getFlashcards).toHaveBeenCalledWith(
        'user-1',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(paged);
    });
  });

  describe('getDueReviews', () => {
    it('should return empty paginated response if user is not provided', async () => {
      const result = await controller.getDueReviews(null);
      expect(result).toEqual(emptyPaginated);
      expect(flashcardsService.getDueReviews).not.toHaveBeenCalled();
    });

    it('should call service getDueReviews with pagination when user is provided', async () => {
      const cards: any[] = [{ id: 'card-due' }];
      const paged: PaginatedResponse<unknown> = {
        data: cards,
        total: 1,
        limit: 50,
        offset: 0,
      };
      (flashcardsService.getDueReviews as jest.Mock).mockResolvedValue(paged);

      const result = await controller.getDueReviews(
        { id: 'user-1' } as any,
        '30',
        '0',
      );
      expect(flashcardsService.getDueReviews).toHaveBeenCalledWith(
        'user-1',
        30,
        0,
      );
      expect(result).toEqual(paged);
    });

    it('should call service getDueReviews with undefined pagination when not provided', async () => {
      const paged: PaginatedResponse<unknown> = {
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
      (flashcardsService.getDueReviews as jest.Mock).mockResolvedValue(paged);

      const result = await controller.getDueReviews({ id: 'user-1' } as any);
      expect(flashcardsService.getDueReviews).toHaveBeenCalledWith(
        'user-1',
        undefined,
        undefined,
      );
      expect(result).toEqual(paged);
    });
  });
});
