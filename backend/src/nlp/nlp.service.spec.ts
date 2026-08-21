import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NlpService } from './nlp.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';

const mockGuess = vi.fn();

vi.mock('node-nlp', () => ({
  Language: vi.fn().mockImplementation(function () {
    return {
      guess: mockGuess,
    };
  }),
}));

describe('NlpService', () => {
  let service: NlpService;
  let mockRedisClient: {
    get: Mock;
    incr: Mock;
    expire: Mock;
    set: Mock;
  };

  let mockConfigService: { get: Mock };
  let mockLlmProxyService: { proxyMessage: Mock };

  beforeEach(async () => {
    mockGuess.mockClear();
    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'DEEPL_API_KEY') return 'mock-deepl-key';
        if (key === 'AZURE_TRANSLATOR_KEY') return 'mock-azure-key';
        if (key === 'AZURE_SPEECH_REGION') return 'mock-region';
        if (key === 'LLM_API_KEY') return 'mock-llm-key';
        return null;
      }),
    };

    mockLlmProxyService = {
      proxyMessage: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NlpService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
        {
          provide: LlmProxyService,
          useValue: mockLlmProxyService,
        },
      ],
    }).compile();

    service = module.get<NlpService>(NlpService);

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockClear();
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

    it('should return a semantic rate-limit response when free tier usage reaches 10', async () => {
      mockRedisClient.get.mockResolvedValue('10');

      await expect(
        service.checkRateLimit('free-user', false),
      ).rejects.toMatchObject({
        status: 429,
        response: {
          statusCode: 429,
          message: expect.stringContaining('8 UKP / $10 USD'),
        },
      });
      expect(mockRedisClient.incr).not.toHaveBeenCalled();
    });
  });

  describe('simplify', () => {
    it('uses the configured LLM to simplify text without sending it to DeepL', async () => {
      mockLlmProxyService.proxyMessage.mockResolvedValueOnce({
        response: 'We kept going even though it rained.',
      });

      const result = await service.simplify('user-1', true, {
        text: 'Although precipitation commenced, we continued our endeavour.',
      });

      expect(result).toEqual({
        original:
          'Although precipitation commenced, we continued our endeavour.',
        simplified: 'We kept going even though it rained.',
      });
      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          'Message as JSON: "Although precipitation commenced, we continued our endeavour."',
        ),
      );
      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('untrusted text'),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty response', { response: '   ' }],
      [
        'an unchanged response',
        {
          response:
            'We will utilise sufficient time to commence the demonstration.',
        },
      ],
      ['a provider failure', new Error('provider unavailable')],
    ])(
      'uses a bounded local fallback after %s',
      async (_description, outcome) => {
        if (outcome instanceof Error) {
          mockLlmProxyService.proxyMessage.mockRejectedValueOnce(outcome);
        } else {
          mockLlmProxyService.proxyMessage.mockResolvedValueOnce(outcome);
        }

        const result = await service.simplify('user-1', true, {
          text: 'We will utilise sufficient time to commence the demonstration.',
        });

        expect(result.simplified).toBe(
          'We will use enough time to start the demonstration.',
        );
      },
    );

    it('reports an unavailable service when no honest local simplification is possible', async () => {
      mockLlmProxyService.proxyMessage.mockRejectedValueOnce(
        new Error('provider unavailable'),
      );

      await expect(
        service.simplify('user-1', true, { text: 'Already simple.' }),
      ).rejects.toMatchObject({
        status: 503,
        response: {
          statusCode: 503,
          message: 'Message simplification is temporarily unavailable',
        },
      });
    });
  });

  describe('translate', () => {
    it('should use custom dictionary translation when exact match exists (es -> en)', async () => {
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ translations: [{ text: 'Hello / Welcome' }] }), // translation
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
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              translations: [{ text: 'Translated [ja → en]: Konnichiwa' }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ translations: [{ text: 'Konnichiwa' }] }),
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
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ language: 'en' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { displayTarget: 'I went to the store yesterday.' },
            ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { translations: [{ text: 'Grammar correction' }] },
            ]),
        });
      const dto = { text: 'I go to store yesterday.' };
      const result = await service.grammarCheck('user-1', true, dto);

      expect(result.corrected).toContain('went to the store yesterday');
      expect(result.errors_found).toBe(1);
    });

    it('should report 0 errors for properly terminated sentence', async () => {
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ language: 'en' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([{ displayTarget: 'Everything is fine.' }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { translations: [{ text: 'Grammar correction' }] },
            ]),
        });
      const dto = { text: 'Everything is fine.' };
      const result = await service.grammarCheck('user-1', true, dto);

      expect(result.corrected).toBe('Everything is fine.');
      expect(result.errors_found).toBe(0);
    });

    it('should append period and report 1 error if sentence lacks ending punctuation', async () => {
      (global.fetch as Mock)
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
          json: () =>
            Promise.resolve([
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
    it('should score words with phonetic breakdown and return positive feedback for high scores', async () => {
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              RecognitionStatus: 'Success',
              DisplayText: 'Hello world test',
              NBest: [
                {
                  PronunciationAssessment: {
                    PronScore: 90,
                    AccuracyScore: 95,
                    FluencyScore: 85,
                    CompletenessScore: 90,
                  },
                  Words: [
                    {
                      Word: 'Hello',
                      Phonemes: [
                        { Phoneme: 'h', AccuracyScore: 92 },
                        { Phoneme: 'ɛ', AccuracyScore: 88 },
                        { Phoneme: 'l', AccuracyScore: 95 },
                        { Phoneme: 'oʊ', AccuracyScore: 90 },
                      ],
                      PronunciationAssessment: { AccuracyScore: 91 },
                    },
                    {
                      Word: 'world',
                      Phonemes: [
                        { Phoneme: 'w', AccuracyScore: 85 },
                        { Phoneme: 'ɝ', AccuracyScore: 80 },
                        { Phoneme: 'l', AccuracyScore: 90 },
                        { Phoneme: 'd', AccuracyScore: 93 },
                      ],
                      PronunciationAssessment: { AccuracyScore: 87 },
                    },
                    {
                      Word: 'test',
                      Phonemes: [
                        { Phoneme: 't', AccuracyScore: 96 },
                        { Phoneme: 'ɛ', AccuracyScore: 88 },
                        { Phoneme: 's', AccuracyScore: 94 },
                        { Phoneme: 't', AccuracyScore: 95 },
                      ],
                      PronunciationAssessment: { AccuracyScore: 93 },
                    },
                  ],
                },
              ],
            }),
        });
      const dto = {
        target_text: 'Hello world test',
        audio_url: 'http://test',
        language: 'en-US',
      };
      const result = await service.pronunciationScore('user-1', true, dto);

      expect(result.breakdown).toHaveLength(3);
      expect(result.overall_score).toBe(95);
      expect(result.feedback_summary).toBe('Excellent pronunciation!');
      expect(result.detected_language).toBe('en-US');
      expect(result.transcription).toBe('Hello world test');

      // Verify phonetic breakdown on first word
      const firstWord = result.breakdown[0];
      expect(firstWord.phonemes.length).toBeGreaterThan(0);
      expect(firstWord.phonemes[0]).toHaveProperty('phoneme');
      expect(firstWord.phonemes[0]).toHaveProperty('score');
      expect(firstWord.phonemes[0]).toHaveProperty('expected_phoneme');
    });

    it('should handle empty target_text gracefully returning 90 default overall score', async () => {
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('audio')),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              RecognitionStatus: 'Success',
              DisplayText: '',
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

    it('should fallback with phonetic breakdown when Azure is unavailable', async () => {
      const dto = {
        target_text: 'Hello world',
        audio_url: 'http://test',
      };
      const result = await service.pronunciationScore('user-1', true, dto);

      expect(result.overall_score).toBe(85);
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0].phonemes.length).toBeGreaterThan(0);
      expect(result.breakdown[0].phonemes[0].expected_phoneme).toBeTruthy();
      expect(result.feedback_summary).toContain('temporarily unavailable');
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

    it('should call DeepL and save the result to Redis when not cached', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => ({
          translations: [{ text: 'App de Prueba' }],
        }),
      });

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'Test App' },
      };

      const result = await service.translateUi(dto);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-free.deepl.com/v2/translate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            text: ['Test App'],
            target_lang: 'ES',
          }),
        }),
      );
      expect(result.cached).toBe(false);
      expect(result.translations['app.title']).toBe('App de Prueba');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'ui_dict:es',
        JSON.stringify({ 'app.title': 'App de Prueba' }),
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith('ui_dict:es', 604800);
    });

    it('should translate dictionaries for any target language dynamically (de)', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => ({
          translations: [{ text: 'Willkommen' }, { text: 'Startseite' }],
        }),
      });

      const dto = {
        target_language: 'de',
        dictionary: { 'app.title': 'Welcome', 'nav.home': 'Home' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(false);
      expect(result.translations).toEqual({
        'app.title': 'Willkommen',
        'nav.home': 'Startseite',
      });
    });

    it('should throw BadRequestException when DeepL API key is not configured', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'AZURE_TRANSLATOR_KEY') return 'mock-azure-key';
        if (key === 'AZURE_SPEECH_REGION') return 'mock-region';
        return null;
      });

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      };

      await expect(service.translateUi(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when DeepL API call fails', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => 'Internal Server Error',
      });

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      };

      await expect(service.translateUi(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should catch Redis errors during get and set gracefully without crashing', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis get fail'));
      mockRedisClient.set.mockRejectedValueOnce(new Error('Redis set fail'));
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => ({
          translations: [{ text: 'Clon de HelloTalk' }],
        }),
      });

      const dto = {
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      };

      const result = await service.translateUi(dto);
      expect(result.cached).toBe(false);
      expect(result.translations['app.title']).toBe('Clon de HelloTalk');
    });
  });

  describe('generateSessionSummary', () => {
    const transcriptText =
      'Welcome to the language exchange room. Today we discussed travel vocabulary and cultural customs in Japan. We compared the Japanese tea ceremony with British afternoon tea traditions. The group also practised ordering food in a restaurant setting.';

    it('should return empty summary for empty text', async () => {
      const result = await service.generateSessionSummary('');
      expect(result.summary).toBe('No transcript available.');
      expect(result.vocabulary).toEqual([]);
    });

    it('should generate summary via LLM proxy when API key is configured', async () => {
      mockLlmProxyService.proxyMessage.mockResolvedValueOnce({
        response: JSON.stringify({
          summary:
            'This session covered travel vocabulary, cultural customs in Japan, and compared tea ceremonies. The group practised restaurant ordering scenarios.',
          vocabulary: [
            'travel',
            'cultural',
            'customs',
            'tea ceremony',
            'restaurant',
            'ordering',
            'vocabulary',
            'practised',
          ],
        }),
      });

      const result = await service.generateSessionSummary(transcriptText);

      expect(mockLlmProxyService.proxyMessage).toHaveBeenCalledTimes(1);
      expect(result.summary).toContain('travel vocabulary');
      expect(result.summary).toContain('tea ceremonies');
      expect(result.vocabulary.length).toBeGreaterThan(0);
      expect(result.vocabulary).toContain('travel');
      expect(result.vocabulary).toContain('tea ceremony');
    });

    it('should fall back to extractSummaryFallback when LLM response lacks JSON', async () => {
      mockLlmProxyService.proxyMessage.mockResolvedValueOnce({
        response: 'Here is a plain text summary without JSON formatting.',
      });

      const result = await service.generateSessionSummary(transcriptText);

      expect(result.summary).toContain('Key topics covered:');
      expect(result.vocabulary.length).toBeGreaterThan(0);
    });

    it('should fall back to extractSummaryFallback when LLM API key is not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_API_KEY') return null;
        if (key === 'DEEPL_API_KEY') return 'mock-deepl-key';
        if (key === 'AZURE_TRANSLATOR_KEY') return 'mock-azure-key';
        if (key === 'AZURE_SPEECH_REGION') return 'mock-region';
        return null;
      });

      const result = await service.generateSessionSummary(transcriptText);

      expect(mockLlmProxyService.proxyMessage).not.toHaveBeenCalled();
      expect(result.summary).toContain('Key topics covered:');
      expect(result.vocabulary.length).toBeGreaterThan(0);
    });

    it('should fall back to extractSummaryFallback when LLM proxy throws', async () => {
      mockLlmProxyService.proxyMessage.mockRejectedValueOnce(
        new Error('LLM unavailable'),
      );

      const result = await service.generateSessionSummary(transcriptText);

      expect(result.summary).toContain('Key topics covered:');
      expect(result.vocabulary.length).toBeGreaterThan(0);
    });
  });
});
