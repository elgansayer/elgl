import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';

describe('SuggestFlashcardsController', () => {
  let controller: SuggestFlashcardsController;
  let suggestService: SuggestFlashcardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuggestFlashcardsController],
      providers: [
        {
          provide: SuggestFlashcardsService,
          useValue: {
            suggestFromMessage: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(SrsRateLimiterGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SuggestFlashcardsController>(
      SuggestFlashcardsController,
    );
    suggestService = module.get<SuggestFlashcardsService>(
      SuggestFlashcardsService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('suggest', () => {
    it('should delegate to suggestFromMessage on the service', async () => {
      const dto = { message: 'Hello world' };
      const expected = { suggestions: ['hello', 'world'] };
      (suggestService.suggestFromMessage as Mock).mockResolvedValue(expected);

      const result = await controller.suggest(dto);

      expect(suggestService.suggestFromMessage).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('should handle empty suggestions response', async () => {
      const dto = { message: '...' };
      (suggestService.suggestFromMessage as Mock).mockResolvedValue({
        suggestions: [],
      });

      const result = await controller.suggest(dto);

      expect(result).toEqual({ suggestions: [] });
    });

    it('should pass through optional fields to the service', async () => {
      const dto = {
        message: 'Bonjour le monde',
        user_id: 'user-1',
        target_language: 'fr',
        exclude_known: true,
      };
      (suggestService.suggestFromMessage as Mock).mockResolvedValue({
        suggestions: ['monde'],
      });

      await controller.suggest(dto);

      expect(suggestService.suggestFromMessage).toHaveBeenCalledWith(dto);
    });
  });
});
