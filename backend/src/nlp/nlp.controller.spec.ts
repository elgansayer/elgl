import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { TranslationRouterService } from './translation-router.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';

describe('NlpController', () => {
  let controller: NlpController;
  let nlpService: NlpService;
  let translationRouterService: TranslationRouterService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        {
          provide: NlpService,
          useValue: {
            detectLanguage: vi.fn(),
            translateUi: vi.fn(),
            grammarCheck: vi.fn(),
            pronunciationScore: vi.fn(),
          },
        },
        {
          provide: TranslationRouterService,
          useValue: {
            translate: vi.fn(),
            transliterate: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(NlpRateLimiterGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<NlpController>(NlpController);
    nlpService = module.get<NlpService>(NlpService);
    translationRouterService = module.get<TranslationRouterService>(
      TranslationRouterService,
    );
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('detectLanguage', () => {
    it('should call service detectLanguage with body text or empty string', () => {
      const response = { language: 'fr', confidence: 0.99 };
      (nlpService.detectLanguage as Mock).mockReturnValue(response);

      expect(controller.detectLanguage({ text: 'Bonjour' })).toEqual(response);
      expect(nlpService.detectLanguage).toHaveBeenCalledWith('Bonjour');

      expect(controller.detectLanguage({})).toEqual(response);
      expect(nlpService.detectLanguage).toHaveBeenCalledWith('');
    });
  });

  describe('translate', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.translate(null, {} as any);
      expect(result).toBeNull();
      expect(translationRouterService.translate).not.toHaveBeenCalled();
    });

    it('should get user profile and call the provider router when user is provided', async () => {
      const dto: any = { text: 'Hola', target_language: 'en' };
      const profile: any = { id: 'user-1', is_vip: true };
      const response: any = { translated_text: 'Hello' };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (translationRouterService.translate as Mock).mockResolvedValue(response);

      const result = await controller.translate({ id: 'user-1' } as any, dto);
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(translationRouterService.translate).toHaveBeenCalledWith(
        'user-1',
        true,
        dto,
      );
      expect(result).toEqual(response);
    });

    it('should fallback to false for isVip when user profile returns undefined is_vip', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({});
      (translationRouterService.translate as Mock).mockResolvedValue({});

      await controller.translate({ id: 'user-1' } as any, {} as any);
      expect(translationRouterService.translate).toHaveBeenCalledWith(
        'user-1',
        false,
        expect.any(Object),
      );
    });
  });

  describe('transliterate', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.transliterate(null, {} as any);
      expect(result).toBeNull();
      expect(translationRouterService.transliterate).not.toHaveBeenCalled();
    });

    it('should resolve VIP state and call the provider router', async () => {
      const dto: any = {
        text: 'こんにちは',
        language: 'ja',
        from_script: 'Jpan',
        to_script: 'Latn',
      };
      const response: any = {
        original_text: 'こんにちは',
        transliterated_text: "Kon'nichiwa",
      };
      (usersService.getProfile as Mock).mockResolvedValue({ is_vip: false });
      (translationRouterService.transliterate as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.transliterate(
        { id: 'user-1' } as any,
        dto,
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(translationRouterService.transliterate).toHaveBeenCalledWith(
        'user-1',
        false,
        dto,
      );
      expect(result).toEqual(response);
    });
  });

  describe('translateUi', () => {
    it('should pass DTO to service and return UI translations', async () => {
      const dto: any = { target_language: 'es', dictionary: {} };
      const response: any = { target_language: 'es', cached: false };
      (nlpService.translateUi as Mock).mockResolvedValue(response);

      const result = await controller.translateUi(dto);
      expect(nlpService.translateUi).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('grammarCheck', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.grammarCheck(null, {} as any);
      expect(result).toBeNull();
      expect(nlpService.grammarCheck).not.toHaveBeenCalled();
    });

    it('should call service grammarCheck when user is provided', async () => {
      const dto: any = { text: 'Check me' };
      const profile: any = { id: 'user-1', is_vip: false };
      const response: any = { corrected: 'Check me.' };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (nlpService.grammarCheck as Mock).mockResolvedValue(response);

      const result = await controller.grammarCheck(
        { id: 'user-1' } as any,
        dto,
      );
      expect(nlpService.grammarCheck).toHaveBeenCalledWith(
        'user-1',
        false,
        dto,
      );
      expect(result).toEqual(response);
    });
  });

  describe('pronunciationScore', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.pronunciationScore(null, {} as any);
      expect(result).toBeNull();
      expect(nlpService.pronunciationScore).not.toHaveBeenCalled();
    });

    it('should call service pronunciationScore when user is provided', async () => {
      const dto: any = { target_text: 'Hello' };
      const profile: any = { id: 'user-1', is_vip: true };
      const response: any = { overall_score: 95 };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (nlpService.pronunciationScore as Mock).mockResolvedValue(response);

      const result = await controller.pronunciationScore(
        { id: 'user-1' } as any,
        dto,
      );
      expect(nlpService.pronunciationScore).toHaveBeenCalledWith(
        'user-1',
        true,
        dto,
      );
      expect(result).toEqual(response);
    });
  });
});
