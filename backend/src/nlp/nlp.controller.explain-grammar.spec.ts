import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CacheControlInterceptor } from '../common/cache.interceptor';
import { UsersService } from '../users/users.service';
import { ExplainGrammarDto } from './dto/explain-grammar.dto';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import {
  NLP_RATE_LIMIT_KEY,
  NlpRateLimiterGuard,
} from './nlp-rate-limiter.guard';
import { TranslationRouterService } from './translation-router.service';
import { PronunciationScoringService } from './pronunciation-scoring.service';

describe('NlpController explainGrammar', () => {
  let checkRateLimit: ReturnType<typeof vi.fn>;
  let getProfile: ReturnType<typeof vi.fn>;
  let explain: ReturnType<typeof vi.fn>;
  let controller: NlpController;

  beforeEach(() => {
    checkRateLimit = vi.fn().mockResolvedValue(undefined);
    getProfile = vi.fn().mockResolvedValue({ is_vip: false });
    explain = vi.fn().mockResolvedValue({
      original: 'I go.',
      corrected: 'I went.',
      explanation: 'Use the past tense.',
    });

    controller = new NlpController(
      { checkRateLimit } as unknown as NlpService,
      { getProfile } as unknown as UsersService,
      {} as unknown as TranslationRouterService,
      {} as unknown as GrammarCheckService,
      { explain } as unknown as GrammarExplanationService,
      {} as unknown as PronunciationScoringService,
    );
  });

  it('applies the existing daily AI allowance before requesting an explanation', async () => {
    const user = { id: 'user-123' } as User;
    const dto = { original: 'I go.', corrected: 'I went.' };

    await expect(controller.explainGrammar(user, dto)).resolves.toEqual({
      original: 'I go.',
      corrected: 'I went.',
      explanation: 'Use the past tense.',
    });

    expect(getProfile).toHaveBeenCalledWith('user-123');
    expect(checkRateLimit).toHaveBeenCalledWith('user-123', false);
    expect(explain).toHaveBeenCalledWith('user-123', dto);
    expect(checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      explain.mock.invocationCallOrder[0],
    );
  });

  it('preserves VIP daily-limit bypass semantics', async () => {
    getProfile.mockResolvedValue({ is_vip: true });

    await controller.explainGrammar({ id: 'vip-user' } as User, {
      original: 'I go.',
      corrected: 'I went.',
    });

    expect(checkRateLimit).toHaveBeenCalledWith('vip-user', true);
  });

  it('does not invoke profile, quota, or provider work without an authenticated user', async () => {
    await expect(
      controller.explainGrammar(null, {
        original: 'I go.',
        corrected: 'I went.',
      }),
    ).resolves.toBeNull();

    expect(getProfile).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(explain).not.toHaveBeenCalled();
  });
});

describe('NlpController explainGrammar HTTP boundary', () => {
  const handler = NlpController.prototype.explainGrammar;

  it('is a POST route that requires authentication and the NLP rate-limit guard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('explain-grammar');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, NlpController)).toEqual([
      SupabaseAuthGuard,
      NlpRateLimiterGuard,
    ]);
  });

  it('limits each user to ten explanations a minute at both rate-limit layers', () => {
    expect(Reflect.getMetadata(NLP_RATE_LIMIT_KEY, handler)).toEqual({
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(10);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
  });

  it('validates the request body with ExplainGrammarDto', () => {
    const parameterTypes: unknown[] = Reflect.getMetadata(
      'design:paramtypes',
      NlpController.prototype,
      'explainGrammar',
    );

    expect(parameterTypes[1]).toBe(ExplainGrammarDto);
  });

  it('marks private explanations as no-store for browsers and the CDN', () => {
    const interceptors: unknown[] = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      handler,
    );
    const cacheControl = interceptors.find(
      (interceptor) => interceptor instanceof CacheControlInterceptor,
    ) as CacheControlInterceptor;
    const setHeader = vi.fn();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer token' } }),
        getResponse: () => ({ setHeader }),
      }),
    };

    cacheControl.intercept(
      context as never,
      { handle: () => ({ pipe: () => undefined }) } as never,
    );

    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(setHeader).toHaveBeenCalledWith(
      'CDN-Cache-Control',
      'private, no-store',
    );
  });
});
