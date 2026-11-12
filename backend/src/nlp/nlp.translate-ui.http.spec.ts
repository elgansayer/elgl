import type { Mock } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
 * Boots the real controller the way main.ts does (raw body, global prefix, shared
 * body parsers, global ValidationPipe) so the interface-translation contract is
 * checked over HTTP rather than only at the method boundary.
 */
describe('POST /api/nlp/translate-ui over HTTP', () => {
  let app: INestApplication;
  let translateUi: Mock;

  /** About the size of the dictionary the web client really sends (110 KiB of JSON). */
  const realClientDictionary = (): Record<string, string> =>
    Object.fromEntries(
      Array.from({ length: 2170 }, (_, index) => [
        `section.group.key${String(index).padStart(5, '0')}`,
        'Translatable interface text sample.',
      ]),
    );

  beforeEach(async () => {
    translateUi = vi
      .fn()
      .mockImplementation((dto: { target_language: string }) =>
        Promise.resolve({
          target_language: dto.target_language,
          translations: { 'nav.discover': 'Descubrir' },
          cached: false,
        }),
      );

    const moduleRef = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        { provide: NlpService, useValue: { translateUi } },
        { provide: GrammarCheckService, useValue: {} },
        { provide: GrammarExplanationService, useValue: {} },
        { provide: PronunciationScoringService, useValue: {} },
        { provide: TranslationRouterService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
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
  });

  it('accepts the dictionary the web client really sends', async () => {
    const body = { target_language: 'es', dictionary: realClientDictionary() };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(100 * 1024);

    const response = await request(app.getHttpServer())
      .post('/api/nlp/translate-ui')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body.translations).toEqual({ 'nav.discover': 'Descubrir' });
    expect(translateUi).toHaveBeenCalledTimes(1);
    expect(Object.keys(translateUi.mock.calls[0][0].dictionary)).toHaveLength(
      2170,
    );
  });

  it('keeps the default body limit on routes that do not need the larger one', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/nlp/detect-language')
      .send({ text: 'x'.repeat(120 * 1024) });

    expect(response.status).toBe(413);
  });

  it.each([
    [
      'an invalid locale',
      { target_language: 'es:admin', dictionary: { a: 'b' } },
    ],
    ['a missing locale', { dictionary: { a: 'b' } }],
    ['an empty dictionary', { target_language: 'es', dictionary: {} }],
    ['a non-string value', { target_language: 'es', dictionary: { a: 1 } }],
    ['an array dictionary', { target_language: 'es', dictionary: ['a'] }],
    [
      'an unexpected property',
      { target_language: 'es', dictionary: { a: 'b' }, admin: true },
    ],
  ])(
    'rejects %s with 400 before it reaches the service',
    async (_label, body) => {
      const response = await request(app.getHttpServer())
        .post('/api/nlp/translate-ui')
        .send(body);

      expect(response.status).toBe(400);
      expect(translateUi).not.toHaveBeenCalled();
    },
  );

  it('drops prototype-sensitive keys instead of failing with a server error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/nlp/translate-ui')
      .set('Content-Type', 'application/json')
      .send(
        '{"target_language":"es","dictionary":{"constructor":"x","__proto__":"y","nav.discover":"Discover"}}',
      );

    expect(response.status).toBe(201);
    const received = translateUi.mock.calls[0][0].dictionary;
    expect(Object.keys(received)).toEqual(['nav.discover']);
    expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
  });

  it('rejects a dictionary beyond the entry limit', async () => {
    const dictionary = Object.fromEntries(
      Array.from({ length: 5001 }, (_, index) => [`k.${index}`, 'x']),
    );

    const response = await request(app.getHttpServer())
      .post('/api/nlp/translate-ui')
      .send({ target_language: 'es', dictionary });

    expect(response.status).toBe(400);
    expect(translateUi).not.toHaveBeenCalled();
  });
});
