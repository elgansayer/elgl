import type { Mock } from 'vitest';
import {
  HttpException,
  HttpStatus,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { LlmProxyService } from '../src/llm-proxy/llm-proxy.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { GrammarCheckService } from '../src/nlp/grammar-check.service';
import { GrammarExplanationService } from '../src/nlp/grammar-explanation.service';
import { NlpController } from '../src/nlp/nlp.controller';
import { NlpRateLimiterGuard } from '../src/nlp/nlp-rate-limiter.guard';
import { NlpService } from '../src/nlp/nlp.service';
import { PronunciationScoringService } from '../src/nlp/pronunciation-scoring.service';
import { TranslationRouterService } from '../src/nlp/translation-router.service';
import { SupabaseService } from '../src/supabase/supabase.service';
import { UsersService } from '../src/users/users.service';

const VALID_TOKEN = 'valid-token';

describe('POST /api/nlp/grammar-check E2E', () => {
  let app: INestApplication;
  let chatCompletion: Mock;
  let checkRateLimit: Mock;
  let getProfile: Mock;
  let redisIncr: Mock;
  let recordError: Mock;
  let logFailure: Mock;

  function grammarCheck(body: unknown, token: string | null = VALID_TOKEN) {
    const call = request(app.getHttpServer()).post('/api/nlp/grammar-check');
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call.send(body as object);
  }

  function providerReply(
    corrected: string,
    explanation: string,
    errorsFound = 1,
  ): string {
    return JSON.stringify({
      corrected,
      explanation,
      errors_found: errorsFound,
    });
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
        { provide: TranslationRouterService, useValue: {} },
        { provide: GrammarExplanationService, useValue: {} },
        { provide: PronunciationScoringService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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

  it('returns a typed correction for an authenticated learner without caching it', async () => {
    chatCompletion.mockResolvedValue(
      providerReply('I went to school yesterday.', 'Use the past tense.'),
    );

    const response = await grammarCheck({
      text: '  I go to school yesterday.  ',
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
    const messages = chatCompletion.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    expect(JSON.parse(messages[1].content)).toEqual({
      language: 'en-GB',
      text: 'I go to school yesterday.',
    });
  });

  it.each([
    ['missing text', {}],
    ['blank text', { text: '   ' }],
    ['oversized text', { text: 'x'.repeat(2001) }],
    ['invalid language', { text: 'Hello', language: '../private' }],
    ['unknown property', { text: 'Hello', user_id: 'other-user' }],
  ])('rejects %s before quota or provider work', async (_name, body) => {
    await grammarCheck(body).expect(400);

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('rejects missing and invalid bearer tokens before provider work', async () => {
    await grammarCheck({ text: 'Hello.' }, null).expect(401);
    await grammarCheck({ text: 'Hello.' }, 'expired-token').expect(401);

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('rejects per-minute and daily quota exhaustion before provider work', async () => {
    redisIncr.mockResolvedValueOnce(21);
    await grammarCheck({ text: 'Hello.' }).expect(429);

    redisIncr.mockResolvedValueOnce(1);
    checkRateLimit.mockRejectedValueOnce(
      new HttpException('Daily limit', HttpStatus.TOO_MANY_REQUESTS),
    );
    await grammarCheck({ text: 'Hello again.' }).expect(429);

    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('returns a generic 503 and records a sanitised provider failure', async () => {
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
    expect(recordError).toHaveBeenCalledWith('grammar-check', 'provider_error');
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain(
      'private sentence',
    );
  });
});
