import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { json, Request, Response } from 'express';
import Stripe from 'stripe';
import { SupabaseAuthGuard } from './../src/auth/supabase-auth.guard';
import { VipGuard } from './../src/monetisation/guards/vip.guard';
import { SupabaseService } from './../src/supabase/supabase.service';
import { NlpService } from './../src/nlp/nlp.service';
import { ThrottlerGuard } from '@nestjs/throttler';

let AppModule: typeof import('../src/app.module').AppModule;

type MockNlpService = {
  detectLanguage: Mock;
  checkRateLimit: Mock;
  translate: Mock;
  grammarCheck: Mock;
  explainGrammar: Mock;
  pronunciationScore: Mock;
  simplify: Mock;
  translateUi: Mock;
  translateBio: Mock;
  translateAndCorrect: Mock;
  generateSessionSummary: Mock;
};

describe('HelloTalk API E2E Integration Suite', () => {
  let app: INestApplication;
  let mockNlpService: MockNlpService;
  let mockSupabaseClient: {
    from: Mock;
    auth: {
      getUser: Mock;
    };
  };
  let mockRedisClient: {
    get: Mock;
    set: Mock;
    expire: Mock;
    incr: Mock;
    lrange: Mock;
    lpush: Mock;
    ltrim: Mock;
  };
  let mockQueryBuilder: {
    select: Mock;
    insert: Mock;
    upsert: Mock;
    update: Mock;
    delete: Mock;
    eq: Mock;
    neq: Mock;
    gt: Mock;
    gte: Mock;
    lt: Mock;
    lte: Mock;
    in: Mock;
    contains: Mock;
    overlaps: Mock;
    order: Mock;
    limit: Mock;
    range: Mock;
    single: Mock;
  };

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://hellotalk.test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CENTRIFUGO_URL = 'http://localhost:8000';
    process.env.CENTRIFUGO_API_KEY = 'test-centrifugo-api-key';
    process.env.CENTRIFUGO_SECRET = 'test-centrifugo-secret';
    process.env.LIVEKIT_URL = 'ws://localhost:7880';
    process.env.LIVEKIT_API_KEY = 'test-livekit-key';
    process.env.LIVEKIT_SECRET = 'test-livekit-secret';
    process.env.CLOUDFLARE_R2_ENDPOINT = 'https://test-r2.example.com';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-r2-access';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-r2-secret';
    process.env.CLOUDFLARE_R2_BUCKET = 'test-bucket';
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://example.com';
    process.env.DEEPL_API_KEY = 'test-deepl-key';
    process.env.AZURE_TRANSLATOR_KEY = 'test-azure-key';
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
    process.env.STRIPE_WEBHOOK_SECRET = 'test-stripe-webhook-secret';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_test';
    process.env.STRIPE_YEARLY_PRICE_ID = 'price_yearly_test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.TRANSFER_SECRET = 'test-transfer-secret';
    process.env.NODE_ENV = 'test';
    process.env.APPLE_SHARED_SECRET = 'test-apple-secret';
    process.env.APPLE_ROOT_CA_CERT_1 = 'test-apple-ca-cert-1';
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://pubsub.googleapis.com/test';
    process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
    process.env.LLM_API_KEY = 'test-llm-key';
    ({ AppModule } = await import('./../src/app.module'));
  });

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
      rpc: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'e2e-user-1', email: 'e2e@hellotalk.com' } },
          error: null,
        }),
      },
    };

    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
      incr: vi.fn().mockResolvedValue(1),
      lrange: vi.fn().mockResolvedValue([]),
      lpush: vi.fn().mockResolvedValue(1),
      ltrim: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn().mockReturnValue(undefined),
    };

    mockNlpService = {
      detectLanguage: vi.fn().mockReturnValue({
        language: 'en',
        confidence: 0.99,
      }),
      checkRateLimit: vi.fn().mockResolvedValue(undefined),
      translate: vi.fn().mockResolvedValue({
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
        transliteration: '',
        definition: '',
        pronunciation_url: '',
      }),
      grammarCheck: vi.fn().mockResolvedValue({
        original: 'hello',
        corrected: 'hello',
        explanation: 'mocked',
        errors_found: 0,
      }),
      explainGrammar: vi.fn().mockResolvedValue({
        original: 'hello',
        corrected: 'hello',
        explanation: 'mocked',
      }),
      pronunciationScore: vi.fn().mockResolvedValue({
        overall_score: 90,
        breakdown: [],
        feedback_summary: 'Good',
      }),
      simplify: vi.fn().mockResolvedValue({
        original: 'hello',
        simplified: 'hello',
      }),
      translateUi: vi
        .fn()
        .mockImplementation((dto?: { target_language?: string }) => ({
          target_language: dto?.target_language ?? 'es',
          translations: {
            'app.title': 'Hola',
            'nav.discover': '🌍 Descubrir',
          },
          cached: false,
        })),
      translateBio: vi.fn().mockResolvedValue({
        original_text: 'text',
        translated_text: 'text',
        detected_language: 'en',
      }),
      translateAndCorrect: vi.fn().mockResolvedValue({
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
        transliteration: '',
        definition: '',
        pronunciation_url: '',
        wordCorrections: [],
      }),
      generateSessionSummary: vi.fn().mockReturnValue({
        summary: '',
        vocabulary: [],
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: vi.fn().mockReturnValue(mockSupabaseClient),
        getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
        validateConfiguration: vi.fn().mockReturnValue(true),
        incrementXp: vi.fn().mockResolvedValue(undefined),
        getUserXp: vi.fn().mockResolvedValue(0),
      })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'e2e-user-1', email: 'e2e@hellotalk.com' };
          return true;
        }),
      })
      .overrideProvider(NlpService)
      .useValue(mockNlpService)
      .overrideGuard(VipGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.use(
      json({
        verify: (
          req: Request & { rawBody?: Buffer },
          _res: Response,
          buf: Buffer,
        ) => {
          req.rawBody = buf;
        },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    if (app) {
      try {
        await app.close();
      } catch {
        // already closed by afterEach
      }
    }
  });

  describe('Core & Public Endpoints', () => {
    it('/ (GET) - should return Hello World from root controller', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hey there!');
    });

    it('/nlp/detect-language (POST) - should detect language accurately', () => {
      return request(app.getHttpServer())
        .post('/nlp/detect-language')
        .send({ text: 'Hello world' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('language');
          expect(res.body).toHaveProperty('confidence');
        });
    });

    it('/nlp/translate-ui (POST) - should return interface translations for target language', () => {
      return request(app.getHttpServer())
        .post('/nlp/translate-ui')
        .send({
          target_language: 'es',
          dictionary: { 'app.title': 'HelloTalk' },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.target_language).toBe('es');
          expect(res.body.translations['nav.discover']).toBe('🌍 Descubrir');
        });
    });

    it('/nlp/simplify (POST) - should simplify an authenticated message', () => {
      return request(app.getHttpServer())
        .post('/nlp/simplify')
        .send({ text: 'A complex sentence' })
        .expect(201)
        .expect({ original: 'hello', simplified: 'hello' });
    });

    it('/monetisation/webhooks/stripe (POST) - should process Stripe webhooks cleanly', () => {
      const payload = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {
              userId: 'e2e-user-1',
              tier: 'developer',
            },
          },
        },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET as string,
      });

      return request(app.getHttpServer())
        .post('/monetisation/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200)
        .expect({ received: true, status: 'processed' });
    });
  });

  describe('Guarded Domain Endpoints (Authenticated E2E Flows)', () => {
    it('/users/profile (GET) - should return authenticated user profile details', () => {
      // First .single() call is consumed by the global LastActiveInterceptor
      // checking last_active_at before the request reaches the controller.
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { last_active_at: null },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'e2e-user-1',
          display_name: 'E2E Learner',
          native_language: 'en',
          target_languages: ['es'],
          is_vip: true,
        },
        error: null,
      });

      return request(app.getHttpServer())
        .get('/users/profile')
        .expect(200)
        .expect((res) => {
          expect(res.body.display_name).toBe('E2E Learner');
          expect(res.body.is_vip).toBe(true);
        });
    });

    it('/discovery/partners (GET) - should return language exchange partners', () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'partner-1',
            display_name: 'Spanish Partner',
            native_language: 'es',
            target_languages: ['en'],
          },
        ],
        error: null,
      });

      return request(app.getHttpServer())
        .get('/discovery/partners?native=es&target=en')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body[0].display_name).toBe('Spanish Partner');
        });
    });

    it('/discovery/audio-intros (GET) - should return visible audio introductions', () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'speaker-1',
            display_name: 'Audio Partner',
            native_languages: ['es'],
            target_languages: ['en'],
            audio_intro_url: 'https://media.example.test/audio-intro.mp3',
          },
        ],
        error: null,
      });

      return request(app.getHttpServer())
        .get('/discovery/audio-intros')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([
            expect.objectContaining({
              id: 'speaker-1',
              display_name: 'Audio Partner',
              audio_intro_url: 'https://media.example.test/audio-intro.mp3',
            }),
          ]);
          expect(mockQueryBuilder.is).toHaveBeenCalledWith(
            'scheduled_for_deletion_at',
            null,
          );
        });
    });

    it('/audio-rooms/create (POST) - should create new audio room and return room object', () => {
      const newRoom = {
        id: 'room-101',
        host_id: 'e2e-user-1',
        title: 'Spanish Practice',
        language: 'es',
        status: 'active',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { last_active_at: null },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: newRoom,
        error: null,
      });

      return request(app.getHttpServer())
        .post('/audio-rooms/create')
        .send({
          title: 'Spanish Practice',
          language_pair: 'EN-ES',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe('room-101');
          expect(res.body.title).toBe('Spanish Practice');
        });
    });

    it('/moments (POST) - should create a practice moment and fan out to followers', () => {
      const newMoment = {
        id: 'moment-500',
        user_id: 'e2e-user-1',
        text_content: 'Practising my vocabulary!',
        media_urls: [],
        media_type: 'none',
        target_language: 'es',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { last_active_at: null },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: newMoment,
        error: null,
      });

      return request(app.getHttpServer())
        .post('/moments')
        .send({
          text_content: 'Practising my vocabulary!',
          target_language: 'es',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe('moment-500');
          expect(res.body.author.display_name).toBeDefined();
        });
    });

    it('/flashcards (POST) - should create or update vocabulary flashcard token', () => {
      const card = {
        id: 'card-99',
        user_id: 'e2e-user-1',
        word_token: 'hola',
        translation: 'hello',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { last_active_at: null },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: card,
        error: null,
      });

      return request(app.getHttpServer())
        .post('/flashcards')
        .send({
          word_token: 'hola',
          translation: 'hello',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.word_token).toBe('hola');
          expect(res.body.translation).toBe('hello');
        });
    });

    it('/economy/catalog (GET) - should return virtual gifts catalog', () => {
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [
          { id: 'gift-1', name: 'Rose', cost_coins: 10 },
          { id: 'gift-2', name: 'Crown', cost_coins: 100 },
        ],
        error: null,
      });

      return request(app.getHttpServer())
        .get('/economy/catalog')
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          expect(res.body[0].name).toBe('Rose');
        });
    });

    it('/monetisation/analytics (GET) - should return developer analytics with dual currency pricing', () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { study_streak_days: 10, correction_ratio: 0.9 },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'e2e-user-1',
          is_vip: true,
          vip_tier: 'developer',
          developer_api_key: 'ht_dev_mocke2ekey',
        },
        error: null,
      });

      return request(app.getHttpServer())
        .get('/monetisation/analytics')
        .expect(200)
        .expect((res) => {
          expect(res.body.pricing_info).toContain('20 UKP / $26 USD per month');
          expect(res.body.pricing_info).toContain('8 UKP / $10 USD per month');
        });
    });
  });
});
