import type { Mock } from 'vitest';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { API_GLOBAL_PREFIX, registerBodyParsers } from '../config/body-parsers';
import { UsersService } from '../users/users.service';
import { GrammarCheckService } from './grammar-check.service';
import { GrammarExplanationService } from './grammar-explanation.service';
import { NlpController } from './nlp.controller';
import { NlpRateLimiterGuard } from './nlp-rate-limiter.guard';
import { NlpService } from './nlp.service';
import { PronunciationScoringService } from './pronunciation-scoring.service';
import { TranslationRouterService } from './translation-router.service';

/**
 * Boots the real controller and the real translation router the way main.ts does,
 * with only the providers' network replaced, so the privacy contract is checked
 * over HTTP: the text a user posts reaches DeepL and Azure without its sensitive
 * values, and the response still carries them.
 */
describe('PII scrubbing for /api/nlp over HTTP', () => {
  const email = 'john.doe@example.com';
  const phone = '+44 7700 900123';
  const placeholderPattern = /PII[A-Z]{8}\d+Z/;

  let app: INestApplication;
  let configValues: Record<string, string | undefined>;

  function bodyOf(callIndex: number): string {
    const [, init] = (global.fetch as Mock).mock.calls[callIndex] as [
      string,
      RequestInit,
    ];
    return typeof init.body === 'string' ? init.body : '';
  }

  function expectNoSensitiveData(callIndex: number): void {
    const body = bodyOf(callIndex);
    for (const sensitive of ['john', 'example.com', '7700', '900123']) {
      expect(body).not.toContain(sensitive);
    }
  }

  function mockProvider(
    build: (url: string, requestBody: string) => unknown,
  ): void {
    global.fetch = vi.fn((url: string, init: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            build(url, typeof init.body === 'string' ? init.body : ''),
          ),
      }),
    );
  }

  beforeEach(async () => {
    configValues = {
      DEEPL_API_KEY: 'deepl-test:fx',
      AZURE_TRANSLATOR_KEY: 'azure-test',
    };
    global.fetch = vi.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        TranslationRouterService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
        {
          provide: NlpService,
          useValue: {
            checkRateLimit: vi.fn().mockResolvedValue(undefined),
            detectLanguage: vi
              .fn()
              .mockReturnValue({ language: 'en', confidence: 0.99 }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn().mockResolvedValue({ is_vip: false }),
          },
        },
        { provide: GrammarCheckService, useValue: {} },
        { provide: GrammarExplanationService, useValue: {} },
        { provide: PronunciationScoringService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          Object.assign(context.switchToHttp().getRequest(), {
            user: { id: 'user-1' },
          });
          return true;
        },
      })
      .overrideGuard(NlpRateLimiterGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    registerBodyParsers(app);
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
    vi.restoreAllMocks();
  });

  describe('POST /api/nlp/translate', () => {
    it('sends DeepL placeholders and returns the translation with the values restored', async () => {
      mockProvider((_url, requestBody) => {
        const sent: { text: string[] } = JSON.parse(requestBody);
        return {
          translations: [
            {
              detected_source_language: 'EN',
              text: sent.text[0]
                .replace('Contact me at', 'Contáctame en')
                .replace('or call', 'o llama al'),
            },
          ],
        };
      });
      const message = `Contact me at ${email} or call ${phone}`;

      const response = await request(app.getHttpServer())
        .post('/api/nlp/translate')
        .send({ text: message, source_language: 'en', target_language: 'es' });

      expect(response.status).toBe(201);
      expect(response.body.translated_text).toBe(
        `Contáctame en ${email} o llama al ${phone}`,
      );
      expect(response.body.original_text).toBe(message);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expectNoSensitiveData(0);
      expect(placeholderPattern.test(bodyOf(0))).toBe(true);
    });

    it('answers 503 and sends nothing sensitive when no provider returns the placeholder intact', async () => {
      mockProvider((url) =>
        url.includes('deepl')
          ? { translations: [{ text: 'Contáctame mañana' }] }
          : [{ translations: [{ text: 'Contáctame mañana', to: 'es' }] }],
      );

      const response = await request(app.getHttpServer())
        .post('/api/nlp/translate')
        .send({
          text: `Contact me at ${email} tomorrow`,
          source_language: 'en',
          target_language: 'es',
        });

      expect(response.status).toBe(503);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
      expect(JSON.stringify(response.body)).not.toContain('john');
    });

    it('makes no provider call for a message that is only sensitive data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/nlp/translate')
        .send({ text: email, source_language: 'en', target_language: 'es' });

      expect(response.status).toBe(201);
      expect(response.body.translated_text).toBe(email);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a missing text with 400 before any provider is called', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/nlp/translate')
        .send({ target_language: 'es' });

      expect(response.status).toBe(400);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/nlp/transliterate', () => {
    it('sends Azure only the text between sensitive values and keeps the values in the result', async () => {
      mockProvider(() => [{ text: 'privet' }, { text: 'poka' }]);

      const response = await request(app.getHttpServer())
        .post('/api/nlp/transliterate')
        .send({
          text: `привет ${email} пока`,
          language: 'ru',
          from_script: 'Cyrl',
          to_script: 'Latn',
        });

      expect(response.status).toBe(201);
      expect(response.body.transliterated_text).toBe(`privet ${email} poka`);
      expect(JSON.parse(bodyOf(0))).toEqual([
        { Text: 'привет ' },
        { Text: ' пока' },
      ]);
      expectNoSensitiveData(0);
    });

    it('makes no Azure call for text that is only sensitive data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/nlp/transliterate')
        .send({
          text: `${email} ${phone}`,
          language: 'ru',
          from_script: 'Cyrl',
          to_script: 'Latn',
        });

      expect(response.status).toBe(201);
      expect(response.body.transliterated_text).toBe(`${email} ${phone}`);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
