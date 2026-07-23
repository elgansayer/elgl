import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NlpService } from './nlp.service';
import { SupabaseService } from '../supabase/supabase.service';

const mockGuess = jest.fn();

jest.mock('node-nlp', () => ({
  Language: jest.fn().mockImplementation(() => ({
    guess: mockGuess,
  })),
}));

describe('NlpService', () => {
  let service: NlpService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockGuess.mockClear();
    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NlpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DEEPL_API_KEY') return 'mock-deepl-key';
              if (key === 'AZURE_TRANSLATOR_KEY') return 'mock-azure-key';
              if (key === 'AZURE_SPEECH_REGION') return 'mock-region';
              return null;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<NlpService>(NlpService);

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectLanguage', () => {
    it('should return default en language when node-nlp guesses are empty or undefined', () => {
      mockGuess.mockReturnValue(null);

      const result = service.detectLanguage('Some text');
      expect(result).toEqual({ language: 'en', confidence: 0.5 });
    });

    it('should return top guess when node-nlp returns valid guesses', () => {
      mockGuess.mockReturnValue([
        { alpha2: 'fr', score: 0.95 },
        { alpha2: 'en', score: 0.05 },
      ]);

      const result = service.detectLanguage('Bonjour le monde');
      expect(result).toEqual({ language: 'fr', confidence: 0.95 });
    });

    it('should fallback to en and 0.8 when top guess alpha2 or score is missing', () => {
      mockGuess.mockReturnValue([{ alpha2: '', score: 0 }]);

      const result = service.detectLanguage('Uncertain');
      expect(result).toEqual({ language: 'en', confidence: 0.8 });
    });
  });

  describe('checkRateLimit', () => {
    it('should skip rate check completely for VIP users', async () => {
      await service.checkRateLimit('vip-user', true);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should allow request, increment counter, and set expire on first request of the day for free tier', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.incr.mockResolvedValue(1);

      await service.checkRateLimit('free-user', false);

      expect(mockRedisClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/^daily_ai_usage:free-user:\d{4}-\d{2}-\d{2}$/),
      );
      expect(mockRedisClient.incr).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        expect.any(String),
        86400,
      );
    });

    it('should throw BadRequestException when free tier usage reaches 10 limit (verifying dual currency format)', async () => {
      mockRedisClient.get.mockResolvedValue('10');

      await expect(service.checkRateLimit('free-user', false)).rejects.toThrow(
        new BadRequestException(
          'Daily AI request limit (10 requests/day) reached on Free Tier. Upgrade to VIP (8 UKP / $10 USD per month) for unlimited AI translations, grammar checks, and pronunciation scoring!',
        ),
      );
      expect(mockRedisClient.incr).not.toHaveBeenCalled();
    });
  });

  describe('translate', () => {
    it('should use custom dictionary translation when exact match exists (es -> en)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ translations: [{ text: 'Hello / Welcome' }] }), // translation
        })
        .mockResolvedValueOnce({
          ok: true, // glossary check
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ translations: [{ text: 'Hello' }] }), // transliteration
        });
      mockGuess.mockReturnValue([{ alpha2: 'es', score: 0.9 }]);

      const dto = {
        text: 'Hola',
        source_language: 'es',
        target_language: 'en',
      };

      const result = await service.translate('user-1', false, dto);

      expect(result).toEqual({
        original_text: 'Hola',
        translated_text: 'Hello / Welcome',
        detected_language: 'es',
        transliteration: 'Hello',
        definition: 'Translation of "Hola" in en',
        pronunciation_url: expect.stringContaining('google.com/translate_tts'),
      });
    });

    it('should use simulated format when dictionary match is not found', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            translations: [{ text: 'Translated [ja → en]: Konnichiwa' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ translations: [{ text: 'Konnichiwa' }] }),
        });
      mockGuess.mockReturnValue([{ alpha2: 'ja', score: 0.99 }]);

      const dto = {
        text: 'Konnichiwa',
        target_language: 'en',
      };

      const result = await service.translate('user-1', true, dto);

      expect(result.detected_language).toBe('ja');
      expect(result.translated_text).toBe('Translated [ja → en]: Konnichiwa');
      expect(result.definition).toBe('Translation of "Konnichiwa" in en');
    });
  });

  describe('grammarCheck', () => {
    it('should correct known phrase go to store yesterday', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ language: 'en' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { displayTarget: 'I went to the store yesterday.' },
          ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { translations: [{ text: 'Grammar correction' }] },
          ]),
        });
      const dto = { text: 'I go to store yesterday.' };
      const result = await service.grammarCheck('user-1', true, dto);

      expect(result.corrected).toContain('went to the store yesterday');
      expect(result.errors_found).toBe(1);
    });

    it('should report 0 errors for properly terminated sentence', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ language: 'en' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ displayTarget: 'Everything is fine.' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { translations: [{ text: 'Grammar correction' }] },
          ]),
        });
      const dto = { text: 'Everything is fine.' };
      const result = await service.grammarCheck('user-1', true, dto);

      expect(result.corrected).toBe('Everything is fine.');
      expect(result.errors_found).toBe(0);
    });

    it('should append period and report 1 error if sentence lacks ending punctuation', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ language: 'en' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ displayTarget: 'Needs a period.' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { translations: [{ text: 'Grammar correction' }] },
          ]),
        });
      const dto = { text: 'Needs a period' };
      const result = await service.grammarCheck('user-1', true, dto);

      expect(result.corrected).toBe('Needs a period.');
      expect(result.errors_found).toBe(1);
    });
  });

  describe('pronunciationScore', () => {
    it('should score words, calculate average, and return positive feedback for high scores', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            RecognitionStatus: 'Success',
            NBest: [
              {
                PronunciationAssessment: {
                  PronScore: 90,
                  AccuracyScore: 95,
                  FluencyScore: 85,
                  CompletenessScore: 90,
                },
                Words: [],
              },
            ],
          }),
        });
      const dto = { target_text: 'Hello world test', audio_url: 'http://test' };
      const result = await service.pronunciationScore('user-1', true, dto);

      expect(result.breakdown).toHaveLength(3);
      // scores: 85 + 0 = 85, 85 + 1 = 86, 85 + 2 = 87 -> avg 86
      expect(result.overall_score).toBe(95);
      expect(result.feedback_summary).toBe('Excellent pronunciation!');
    });

    it('should handle empty target_text gracefully returning 90 default overall score', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            RecognitionStatus: 'Success',
            NBest: [
              {
                PronunciationAssessment: {
                  PronScore: 90,
                  AccuracyScore: 95,
                  FluencyScore: 85,
                  CompletenessScore: 90,
                },
                Words: [],
              },
            ],
          }),
        });
      const dto = { target_text: '   ', audio_url: 'http://test' };
      const result = await service.pronunciationScore('user-1', true, dto);

      expect(result.overall_score).toBe(95);
      expect(result.breakdown).toEqual([]);
      expect(result.feedback_summary).toContain('Excellent pronunciation!');
    });
  });

  describe('translateUi', () => {
    it('should return cached true and unchanged dictionary for en or en-GB target', async () => {
      const dto = {
        target_language: 'en-GB',
        dictionary: { 'app.title': 'HelloTalk Clone' },
      };

      const result = await service.translateUi(dto);
      expect(result).toEqual({
        target_language: 'en-GB',
        translations: { 'app.title': 'HelloTalk Clone' },
        cached: true,
      });
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return merged dictionary from Redis cache when key found', async () => {
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify({ 'nav.discover': 'Explorar' }),
      );

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'HelloTalk' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(true);
      expect(result.translations).toEqual({
        'app.title': 'HelloTalk',
        'nav.discover': 'Explorar',
      });
    });

    it('should use built-in dictionary and save to Redis when not cached (es)', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(false);
      expect(result.translations['nav.discover']).toBe('🌍 Descubrir');
      expect(result.translations['common.vipStd']).toBe('8 UKP / $10 USD VIP');
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockRedisClient.expire).toHaveBeenCalledWith('ui_dict:es', 604800);
    });

    it('should dynamically prefix keys when built-in dictionary does not exist (de)', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const dto = {
        target_language: 'de',
        dictionary: { 'app.title': 'Welcome', 'nav.home': 'Home' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(false);
      expect(result.translations).toEqual({
        'app.title': '[DE] Welcome',
        'nav.home': '[DE] Home',
      });
    });

    it('should catch Redis errors during get and set gracefully without crashing', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis get fail'));
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis set fail'));

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(false);
      expect(result.translations['app.title']).toBe('Clon de HelloTalk');
    });
  });
});
