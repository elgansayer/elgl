import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SupabaseAuthGuard } from './../src/auth/supabase-auth.guard';
import { SupabaseService } from './../src/supabase/supabase.service';
import { NlpService } from './../src/nlp/nlp.service';

jest.setTimeout(60000);

type MockNlpService = {
  detectLanguage: jest.Mock;
  checkRateLimit: jest.Mock;
  translate: jest.Mock;
  grammarCheck: jest.Mock;
  explainGrammar: jest.Mock;
  pronunciationScore: jest.Mock;
  simplify: jest.Mock;
  translateUi: jest.Mock;
  translateBio: jest.Mock;
  translateAndCorrect: jest.Mock;
  generateSessionSummary: jest.Mock;
};

describe('HelloTalk API E2E Integration Suite', () => {
  let app: INestApplication<App>;
  let mockNlpService: MockNlpService;
  let mockSupabaseClient: any;
  let mockRedisClient: any;
  let mockQueryBuilder: any;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://hellotalk.test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CENTRIFUGO_API_KEY = 'test-centrifugo-api-key';
    process.env.CENTRIFUGO_SECRET = 'test-centrifugo-secret';
    process.env.LIVEKIT_API_KEY = 'test-livekit-key';
    process.env.LIVEKIT_SECRET = 'test-livekit-secret';
    process.env.LIVEKIT_URL = 'ws://localhost:7880';
    process.env.CLOUDFLARE_R2_ENDPOINT = 'https://test-r2.example.com';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test-r2-access';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-r2-secret';
    process.env.CLOUDFLARE_R2_BUCKET = 'test-bucket';
    process.env.DEEPL_API_KEY = 'test-deepl-key';
    process.env.AZURE_TRANSLATOR_KEY = 'test-azure-key';
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
    process.env.STRIPE_WEBHOOK_SECRET = 'test-stripe-webhook-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'e2e-user-1', email: 'e2e@hellotalk.com' } },
          error: null,
        }),
      },
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      lpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
    };

    mockNlpService = {
      detectLanguage: jest.fn().mockReturnValue({
        language: 'en',
        confidence: 0.99,
      }),
      checkRateLimit: jest.fn().mockResolvedValue(undefined),
      translate: jest.fn().mockResolvedValue({
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
        transliteration: '',
        definition: '',
        pronunciation_url: '',
      }),
      grammarCheck: jest.fn().mockResolvedValue({
        original: 'hello',
        corrected: 'hello',
        explanation: 'mocked',
        errors_found: 0,
      }),
      explainGrammar: jest.fn().mockResolvedValue({
        original: 'hello',
        corrected: 'hello',
        explanation: 'mocked',
      }),
      pronunciationScore: jest.fn().mockResolvedValue({
        overall_score: 90,
        breakdown: [],
        feedback_summary: 'Good',
      }),
      simplify: jest.fn().mockResolvedValue({
        original: 'hello',
        simplified: 'hello',
      }),
      translateUi: jest
        .fn()
        .mockImplementation((dto?: { target_language?: string }) => ({
          target_language: dto?.target_language ?? 'es',
          translations: {
            'app.title': 'Hola',
            'nav.discover': '🌍 Descubrir',
          },
          cached: false,
        })),
      translateBio: jest.fn().mockResolvedValue({
        original_text: 'text',
        translated_text: 'text',
        detected_language: 'en',
      }),
      translateAndCorrect: jest.fn().mockResolvedValue({
        original_text: 'hello',
        translated_text: 'hola',
        detected_language: 'en',
        transliteration: '',
        definition: '',
        pronunciation_url: '',
        wordCorrections: [],
      }),
      generateSessionSummary: jest.fn().mockReturnValue({
        summary: '',
        vocabulary: [],
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: jest.fn().mockReturnValue(mockSupabaseClient),
        getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
        validateConfiguration: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'e2e-user-1', email: 'e2e@hellotalk.com' };
          return true;
        }),
      })
      .overrideProvider(NlpService)
      .useValue(mockNlpService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
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

    it('/monetisation/webhooks/stripe (POST) - should process Stripe webhooks cleanly', () => {
      return request(app.getHttpServer())
        .post('/monetisation/webhooks/stripe')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              metadata: {
                userId: 'e2e-user-1',
                tier: 'developer',
              },
            },
          },
        })
        .expect(200)
        .expect({ received: true, status: 'processed' });
    });
  });

  describe('Guarded Domain Endpoints (Authenticated E2E Flows)', () => {
    it('/users/profile (GET) - should return authenticated user profile details', () => {
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

    it('/audio-rooms/create (POST) - should create new audio room and return room object', () => {
      const newRoom = {
        id: 'room-101',
        host_id: 'e2e-user-1',
        title: 'Spanish Practice',
        language: 'es',
        status: 'active',
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: newRoom,
        error: null,
      });

      return request(app.getHttpServer())
        .post('/audio-rooms/create')
        .send({
          title: 'Spanish Practice',
          language: 'es',
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
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('Rose');
        });
    });

    it('/monetisation/analytics (GET) - should return developer analytics with dual currency pricing', () => {
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
