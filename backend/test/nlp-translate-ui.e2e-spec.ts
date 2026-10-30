import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { SupabaseService } from '../src/supabase/supabase.service';
import { UsersService } from '../src/users/users.service';
import { GrammarCheckService } from '../src/nlp/grammar-check.service';
import { GrammarExplanationService } from '../src/nlp/grammar-explanation.service';
import { NlpController } from '../src/nlp/nlp.controller';
import { NlpService } from '../src/nlp/nlp.service';
import { NlpRateLimiterGuard } from '../src/nlp/nlp-rate-limiter.guard';
import { PronunciationScoringService } from '../src/nlp/pronunciation-scoring.service';
import { TranslationRouterService } from '../src/nlp/translation-router.service';
import {
  UI_TRANSLATION_DAILY_CHARACTER_BUDGET,
  UiDictionaryTranslationService,
} from '../src/nlp/ui-dictionary-translation.service';

/** In-memory Redis stand-in covering the commands the translation service uses. */
function createFakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    mget: (...keys: string[]) =>
      Promise.resolve(keys.map((key) => store.get(key) ?? null)),
    pipeline: () => {
      const writes: Array<() => void> = [];
      const pipeline = {
        set: (key: string, value: string) => {
          writes.push(() => store.set(key, value));
          return pipeline;
        },
        exec: () => {
          writes.forEach((write) => write());
          return Promise.resolve([]);
        },
      };
      return pipeline;
    },
    incrby: (key: string, amount: number) => {
      const next = Number(store.get(key) ?? 0) + amount;
      store.set(key, String(next));
      return Promise.resolve(next);
    },
    decrby: (key: string, amount: number) => {
      const next = Number(store.get(key) ?? 0) - amount;
      store.set(key, String(next));
      return Promise.resolve(next);
    },
    expire: () => Promise.resolve(1),
  };
}

function providerReply(prefix: string) {
  return (_url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(
      typeof init.body === 'string' ? init.body : '{"text":[]}',
    ) as { text: string[] };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          translations: body.text.map((text) => ({ text: `${prefix}${text}` })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  };
}

describe('POST /nlp/translate-ui (E2E)', () => {
  let app: INestApplication;
  let redis: ReturnType<typeof createFakeRedis>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    redis = createFakeRedis();
    fetchSpy = vi.spyOn(globalThis, 'fetch');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NlpController],
      providers: [
        UiDictionaryTranslationService,
        { provide: NlpService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: TranslationRouterService, useValue: {} },
        { provide: GrammarCheckService, useValue: {} },
        { provide: GrammarExplanationService, useValue: {} },
        { provide: PronunciationScoringService, useValue: {} },
        { provide: SupabaseService, useValue: { getRedisClient: () => redis } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'DEEPL_API_KEY' ? 'deepl-key' : undefined,
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers.authorization) return false;
          req.user = { id: 'user-1' };
          return true;
        },
      })
      .overrideGuard(NlpRateLimiterGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  function post(body: unknown, authenticated = true) {
    const req = request(app.getHttpServer()).post('/nlp/translate-ui');
    return (authenticated ? req.set('Authorization', 'Bearer test') : req).send(
      body as object,
    );
  }

  it('translates a batch of interface strings and keeps placeholders intact', async () => {
    fetchSpy.mockImplementation(providerReply('[es] '));

    const response = await post({
      target_language: 'es',
      dictionary: {
        'nav.home': 'Home',
        'common.coinsBalance': '{{coins}} Coins',
      },
    }).expect(201);

    expect(response.body).toEqual({
      target_language: 'es',
      translations: {
        'nav.home': '[es] Home',
        'common.coinsBalance': '[es] {{coins}} Coins',
      },
      cached: false,
    });
  });

  it('never lets a browser or shared cache store the response', async () => {
    fetchSpy.mockImplementation(providerReply('[es] '));

    const response = await post({
      target_language: 'es',
      dictionary: { 'nav.home': 'Home' },
    }).expect(201);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['cdn-cache-control']).toBe('private, no-store');
  });

  it('serves a repeated request from the cache without another provider call', async () => {
    fetchSpy.mockImplementation(providerReply('[de] '));
    const body = { target_language: 'de', dictionary: { 'nav.home': 'Home' } };

    await post(body).expect(201);
    const second = await post(body).expect(201);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.body.cached).toBe(true);
    expect(second.body.translations['nav.home']).toBe('[de] Home');
  });

  it('accepts a full-size batch of typical strings within the default body limit', async () => {
    fetchSpy.mockImplementation(providerReply(''));
    const dictionary = Object.fromEntries(
      Array.from({ length: 500 }, (_, index) => [
        `section.subsection.key${index}`,
        `A typical interface label number ${index}`,
      ]),
    );

    const response = await post({ target_language: 'fr', dictionary }).expect(
      201,
    );

    expect(Object.keys(response.body.translations)).toHaveLength(500);
  });

  it('requires an authenticated user', async () => {
    await post(
      { target_language: 'es', dictionary: { 'nav.home': 'Home' } },
      false,
    ).expect(403);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing language', { dictionary: { a: 'Home' } }],
    [
      'an invalid language',
      { target_language: 'es; drop', dictionary: { a: 'Home' } },
    ],
    ['an empty dictionary', { target_language: 'es', dictionary: {} }],
    ['a non-string value', { target_language: 'es', dictionary: { a: 7 } }],
    [
      'too many entries',
      {
        target_language: 'es',
        dictionary: Object.fromEntries(
          Array.from({ length: 501 }, (_, index) => [`k${index}`, 'Home']),
        ),
      },
    ],
    [
      'an unexpected property',
      { target_language: 'es', dictionary: { a: 'Home' }, extra: true },
    ],
  ])('rejects %s before any provider is called', async (_label, body) => {
    await post(body).expect(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a provider outage as 503 without exposing provider details', async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"message":"internal provider secret detail"}', {
        status: 500,
      }),
    );

    const response = await post({
      target_language: 'es',
      dictionary: { 'nav.home': 'Home' },
    }).expect(503);

    expect(JSON.stringify(response.body)).not.toContain('secret detail');
  });

  it('rejects with 429 once the user has used the daily provider budget', async () => {
    const day = new Date().toISOString().slice(0, 10);
    redis.store.set(
      `ui_i18n:budget:user-1:${day}`,
      String(UI_TRANSLATION_DAILY_CHARACTER_BUDGET),
    );

    await post({
      target_language: 'es',
      dictionary: { 'nav.home': 'Home' },
    }).expect(429);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
