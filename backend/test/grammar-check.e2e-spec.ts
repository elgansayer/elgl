import type { Mock } from 'vitest';
import {
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { LlmProxyService } from '../src/llm-proxy/llm-proxy.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { GrammarCheckService } from '../src/nlp/grammar-check.service';
import { GrammarExplanationService } from '../src/nlp/grammar-explanation.service';
import { NlpController } from '../src/nlp/nlp.controller';
import { NlpService } from '../src/nlp/nlp.service';
import { NlpRateLimiterGuard } from '../src/nlp/nlp-rate-limiter.guard';
import { PronunciationScoringService } from '../src/nlp/pronunciation-scoring.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { UsersService } from '../src/users/users.service';

const VALID_TOKEN = 'valid-token';

describe('POST /nlp/grammar-check E2E', () => {
  let app: INestApplication;
  let chatCompletion: Mock;
  let checkRateLimit: Mock;
  let getProfile: Mock;
  let redisIncr: Mock;
  let recordError: Mock;
  let logFailure: Mock;

  function grammarCheck(body: unknown, token: string | null = VALID_TOKEN) {
    const call = request(app.getHttpServer()).post('/nlp/grammar-check');
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call.send(body as object);
  }

  function providerReply(corrected: string, explanation: string, errors = 1) {
    return JSON.stringify({ corrected, explanation, errors_found: errors });
  }

  beforeEach(async () => {
    chatCompletion = vi.fn();
    checkRateLimit = vi.fn().mockResolvedValue(undefined);
    getProfile = vi.fn().mockResolvedValue({ id: 'user-1', is_vip: false });
    redisIncr = vi.fn().mockResolvedValue(1);
    recordError = vi.fn();
    logFailure = vi.fn();

    const getUser = vi.fn((token: string) =>
      Promise.resolve(
        token === VALID_TOKEN
          ? { data: { user: { id: 'user-1' } }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } },
      ),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        SupabaseAuthGuard,
        NlpRateLimiterGuard,
        GrammarCheckService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ auth: { getUser } }),
            getRedisClient: () => ({
              incr: redisIncr,
              expire: vi.fn().mockResolvedValue(1),
              ttl: vi.fn().mockResolvedValue(60),
            }),
          },
        },
        {
          provide: getLoggerToken(NlpRateLimiterGuard.name),
          useValue: { warn: vi.fn(), error: vi.fn() },
        },
        {
          provide: getLoggerToken(GrammarCheckService.name),
          useValue: { warn: logFailure },
        },
        { provide: LlmProxyService, useValue: { chatCompletion } },
        {
          provide: MetricsService,
          useValue: {
            recordReadingEngineAiRequest: vi.fn(),
            recordReadingEngineAiRequestDuration: vi.fn(),
            recordReadingEngineAiError: recordError,
          },
        },
        { provide: NlpService, useValue: { checkRateLimit } },
        { provide: UsersService, useValue: { getProfile } },
        { provide: GrammarExplanationService, useValue: {} },
        { provide: PronunciationScoringService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors the production bootstrap in src/main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('happy path', () => {
    it('returns the typed correction for the authenticated learner and forbids caching', async () => {
      chatCompletion.mockResolvedValue(
        providerReply('I went to school yesterday.', 'Use the past tense.'),
      );

      const response = await grammarCheck({
        text: 'I go to school yesterday.',
        language: 'en-GB',
      }).expect(201);

      expect(response.body).toEqual({
        original: 'I go to school yesterday.',
        corrected: 'I went to school yesterday.',
        explanation: 'Use the past tense.',
        errors_found: 1,
      });
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(checkRateLimit).toHaveBeenCalledWith('user-1', false);
      expect(chatCompletion).toHaveBeenCalledOnce();
    });

    it('trims the submitted text before checking and echoing it', async () => {
      chatCompletion.mockResolvedValue(
        providerReply('I went home.', 'Use the past tense.'),
      );

      const response = await grammarCheck({ text: '  I go home.  ' }).expect(
        201,
      );

      expect(response.body.original).toBe('I go home.');
      const messages = chatCompletion.mock.calls[0][0] as { content: string }[];
      expect(JSON.parse(messages[1].content)).toEqual({
        language: 'auto-detect',
        text: 'I go home.',
      });
    });

    it('reports zero errors for text the provider leaves unchanged', async () => {
      chatCompletion.mockResolvedValue(providerReply('Already fine.', '', 3));

      const response = await grammarCheck({ text: 'Already fine.' }).expect(
        201,
      );

      expect(response.body).toMatchObject({
        corrected: 'Already fine.',
        errors_found: 0,
      });
    });

    it('applies the VIP exemption from the daily AI quota', async () => {
      getProfile.mockResolvedValue({ id: 'user-1', is_vip: true });
      chatCompletion.mockResolvedValue(providerReply('Fine.', '', 0));

      await grammarCheck({ text: 'Fine.' }).expect(201);

      expect(checkRateLimit).toHaveBeenCalledWith('user-1', true);
    });
  });

  describe('authentication', () => {
    it('rejects a request without a bearer token', async () => {
      await grammarCheck({ text: 'Hello.' }, null).expect(401);

      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(chatCompletion).not.toHaveBeenCalled();
    });

    it('rejects a token that Supabase does not accept', async () => {
      await grammarCheck({ text: 'Hello.' }, 'expired-token').expect(401);

      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it.each([
      ['a missing text field', {}],
      ['whitespace only text', { text: '   ' }],
      ['text over 2,000 characters', { text: 'x'.repeat(2_001) }],
      ['a non-string text field', { text: 42 }],
      ['a malformed language tag', { text: 'Hello', language: '../private' }],
      [
        'an over-long language tag',
        { text: 'Hello', language: 'a'.repeat(36) },
      ],
      ['an unknown property', { text: 'Hello', user_id: 'someone-else' }],
    ])('rejects %s before any quota or provider work', async (_name, body) => {
      await grammarCheck(body).expect(400);

      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(chatCompletion).not.toHaveBeenCalled();
    });

    it('accepts text at exactly 2,000 characters', async () => {
      const text = 'x'.repeat(2_000);
      chatCompletion.mockResolvedValue(providerReply(text, '', 0));

      await grammarCheck({ text }).expect(201);
    });
  });

  describe('abuse resistance', () => {
    it('answers 429 once the per-minute NLP limit for the endpoint is exceeded', async () => {
      redisIncr.mockResolvedValue(21);

      await grammarCheck({ text: 'Hello.' }).expect(429);

      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(chatCompletion).not.toHaveBeenCalled();
    });

    it('answers 429 without calling the provider when the daily AI quota is spent', async () => {
      checkRateLimit.mockRejectedValue(
        new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Daily limit' },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );

      await grammarCheck({ text: 'Hello.' }).expect(429);

      expect(chatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('provider failure', () => {
    it('fails closed with a generic 503 that leaks neither the text nor the provider error', async () => {
      chatCompletion.mockRejectedValue(
        new Error('upstream echoed: my private sentence'),
      );

      const response = await grammarCheck({
        text: 'my private sentence',
      }).expect(503);

      expect(response.body.message).toBe(
        'Grammar checking is temporarily unavailable',
      );
      expect(JSON.stringify(response.body)).not.toContain('private sentence');
      expect(JSON.stringify(response.body)).not.toContain('upstream');
    });

    it('records a sanitised failure for operators without the private text', async () => {
      chatCompletion.mockRejectedValue(
        new Error('upstream echoed: my private sentence'),
      );

      await grammarCheck({ text: 'my private sentence' }).expect(503);

      expect(recordError).toHaveBeenCalledWith(
        'grammar-check',
        'provider_error',
      );
      expect(logFailure).toHaveBeenCalledOnce();
      expect(JSON.stringify(logFailure.mock.calls)).not.toContain(
        'private sentence',
      );
    });

    it.each([
      ['a non-JSON reply', 'Sorry, I cannot help with that.'],
      ['an empty reply', ''],
      ['a reply with the wrong shape', JSON.stringify({ corrected: 1 })],
    ])('fails closed with 503 for %s', async (_name, reply) => {
      chatCompletion.mockResolvedValue(reply);

      await grammarCheck({ text: 'Hello.' }).expect(503);

      expect(recordError).toHaveBeenCalledWith(
        'grammar-check',
        'invalid_response',
      );
    });
  });
});
