import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { PronunciationScoringService } from './pronunciation-scoring.service';
import { UsersService } from '../users/users.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';

describe('NlpController', () => {
  let controller: NlpController;
  let nlpService: NlpService;
  let grammarCheckService: GrammarCheckService;
  let pronunciationScoringService: PronunciationScoringService;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        {
          provide: NlpService,
          useValue: {
            detectLanguage: vi.fn(),
            translate: vi.fn(),
            translateUi: vi.fn(),
            checkRateLimit: vi.fn(),
          },
        },
        {
          provide: GrammarCheckService,
          useValue: {
            check: vi.fn(),
          },
        },
        {
          provide: GrammarExplanationService,
          useValue: {
            explain: vi.fn(),
          },
        },
        {
          provide: PronunciationScoringService,
          useValue: {
            score: vi.fn(),
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
    grammarCheckService = module.get<GrammarCheckService>(GrammarCheckService);
    pronunciationScoringService = module.get<PronunciationScoringService>(
      PronunciationScoringService,
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
      expect(nlpService.translate).not.toHaveBeenCalled();
    });

    it('should get user profile and call service translate when user is provided', async () => {
      const dto: any = { text: 'Hola', target_language: 'en' };
      const profile: any = { id: 'user-1', is_vip: true };
      const response: any = { translated_text: 'Hello' };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (nlpService.translate as Mock).mockResolvedValue(response);

      const result = await controller.translate({ id: 'user-1' } as any, dto);
      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(nlpService.translate).toHaveBeenCalledWith('user-1', true, dto);
      expect(result).toEqual(response);
    });

    it('should fallback to false for isVip when user profile returns undefined is_vip', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({});
      (nlpService.translate as Mock).mockResolvedValue({});

      await controller.translate({ id: 'user-1' } as any, {} as any);
      expect(nlpService.translate).toHaveBeenCalledWith(
        'user-1',
        false,
        expect.any(Object),
      );
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
      expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
      expect(grammarCheckService.check).not.toHaveBeenCalled();
    });

    it('should preserve daily AI limits and call the bounded grammar provider', async () => {
      const dto: any = { text: 'I go yesterday' };
      const profile: any = { id: 'user-1', is_vip: false };
      const response: any = {
        original: 'I go yesterday',
        corrected: 'I went yesterday.',
        explanation: 'Use the past tense and ending punctuation.',
        errors_found: 2,
      };

      (usersService.getProfile as Mock).mockResolvedValue(profile);
      (nlpService.checkRateLimit as Mock).mockResolvedValue(undefined);
      (grammarCheckService.check as Mock).mockResolvedValue(response);

      const result = await controller.grammarCheck(
        { id: 'user-1' } as any,
        dto,
      );

      expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
      expect(nlpService.checkRateLimit).toHaveBeenCalledWith('user-1', false);
      expect(grammarCheckService.check).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });

    it('should skip the free-tier daily cap for VIP profiles', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({ is_vip: true });
      (grammarCheckService.check as Mock).mockResolvedValue({
        original: 'Fine.',
        corrected: 'Fine.',
        explanation: 'No grammar changes suggested.',
        errors_found: 0,
      });

      await controller.grammarCheck({ id: 'vip-user' } as any, {
        text: 'Fine.',
      });

      expect(nlpService.checkRateLimit).toHaveBeenCalledWith('vip-user', true);
    });
  });

  describe('pronunciationScore', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.pronunciationScore(null, {} as any);
      expect(result).toBeNull();
      expect(nlpService.checkRateLimit).not.toHaveBeenCalled();
      expect(pronunciationScoringService.score).not.toHaveBeenCalled();
    });

    it('should enforce the daily AI quota before calling the pronunciation provider', async () => {
      const dto: any = {
        target_text: 'Hello',
        audio_url: 'https://media.example.com/hello.wav',
        language: 'en-US',
      };
      const response: any = { overall_score: 95 };
      (usersService.getProfile as Mock).mockResolvedValue({ is_vip: false });
      (nlpService.checkRateLimit as Mock).mockResolvedValue(undefined);
      (pronunciationScoringService.score as Mock).mockResolvedValue(response);

      const result = await controller.pronunciationScore(
        { id: 'user-1' } as any,
        dto,
      );

      expect(nlpService.checkRateLimit).toHaveBeenCalledWith('user-1', false);
      expect(pronunciationScoringService.score).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });

    it('does not call Azure when the daily quota rejects the request', async () => {
      (usersService.getProfile as Mock).mockResolvedValue({ is_vip: false });
      (nlpService.checkRateLimit as Mock).mockRejectedValue(new Error('limit'));

      await expect(
        controller.pronunciationScore({ id: 'user-1' } as any, {
          target_text: 'Hello',
          audio_url: 'https://media.example.com/hello.wav',
        }),
      ).rejects.toThrow('limit');
      expect(pronunciationScoringService.score).not.toHaveBeenCalled();
    });
  });
});
