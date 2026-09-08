import type { Mock } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SrsRateLimiterGuard } from './srs-rate-limiter.guard';

describe('SuggestFlashcardsController', () => {
  let controller: SuggestFlashcardsController;
  let suggestService: SuggestFlashcardsService;

  const authenticatedUser = { id: 'authenticated-user' } as User;

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

  it('delegates suggestions using the authenticated user id', async () => {
    const dto = { message: 'Hello world' };
    const expected = { suggestions: ['hello', 'world'] };
    (suggestService.suggestFromMessage as Mock).mockResolvedValue(expected);

    const result = await controller.suggest(authenticatedUser, dto);

    expect(suggestService.suggestFromMessage).toHaveBeenCalledWith(
      'authenticated-user',
      dto,
    );
    expect(result).toEqual(expected);
  });

  it('ignores a legacy user_id as an ownership signal', async () => {
    const dto = {
      message: 'Bonjour le monde',
      user_id: 'attacker-selected-user',
      target_language: 'fr',
      exclude_known: true,
    };
    (suggestService.suggestFromMessage as Mock).mockResolvedValue({
      suggestions: ['monde'],
    });

    await controller.suggest(authenticatedUser, dto);

    expect(suggestService.suggestFromMessage).toHaveBeenCalledWith(
      'authenticated-user',
      dto,
    );
  });

  it('fails closed when no authenticated user is available', async () => {
    await expect(
      controller.suggest(null, { message: 'Hello world' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(suggestService.suggestFromMessage).not.toHaveBeenCalled();
  });
});
