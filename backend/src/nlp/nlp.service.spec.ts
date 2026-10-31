import type { Mock } from 'vitest';
import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    mget: Mock;
    pipeline: Mock;
  };
  let mockPipeline: { set: Mock; exec: Mock };

  let mockConfigService: { get: Mock };
  let mockLlmProxyService: { proxyMessage: Mock };

  beforeEach(async () => {
    mockGuess.mockClear();
    mockPipeline = {
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
      mget: vi.fn((...keys: string[]) => Promise.resolve(keys.map(() => null))),
      pipeline: vi.fn().mockReturnValue(mockPipeline),
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
    const cacheKey = (locale: string, source: string): string =>
      `ui_str:${locale}:${createHash('sha256').update(source, 'utf8').digest('hex')}`;

    const requestJson = (
      init: RequestInit,
    ): { text: string[]; target_lang: string } => {
      if (typeof init.body !== 'string') {
        throw new Error('Expected a JSON string request body');
      }
      return JSON.parse(init.body) as { text: string[]; target_lang: string };
    };

    /** DeepL stand-in that "translates" by prefixing, and records every request body. */
    const translatingFetch = (prefix = 'ES:') =>
      vi.fn((_url: string, init: RequestInit) => {
        const { text } = requestJson(init);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              translations: text.map((item) => ({ text: `${prefix}${item}` })),
            }),
        });
      });

    const sentBodies = (): Array<{ text: string[]; target_lang: string }> =>
      (global.fetch as Mock).mock.calls.map(([, init]: [string, RequestInit]) =>
        requestJson(init),
      );

    /** Stateful in-memory stand-in for the shared Redis cache. */
    const useSharedCache = () => {
      const store = new Map<string, string>();
      mockRedisClient.mget.mockImplementation((...keys: string[]) =>
        Promise.resolve(keys.map((key) => store.get(key) ?? null)),
      );
      mockRedisClient.pipeline.mockImplementation(() => {
        const queued: Array<[string, string]> = [];
        const pipeline = {
          set: vi.fn((key: string, value: string) => {
            queued.push([key, value]);
            return pipeline;
          }),
          exec: vi.fn(() => {
            queued.forEach(([key, value]) => store.set(key, value));
            return Promise.resolve([]);
          }),
        };
        return pipeline;
      });
      return store;
    };

    let logSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    describe.each(['en', 'en-GB', 'en-US', 'EN-gb'])(
      'English locale %s',
      (locale) => {
        it('returns the dictionary unchanged without touching Redis or the provider', async () => {
          const dictionary = { 'app.title': 'HelloTalk Clone' };

          const result = await service.translateUi({
            target_language: locale,
            dictionary,
          });

          expect(result).toEqual({
            target_language: locale,
            translations: dictionary,
            cached: true,
          });
          expect(mockRedisClient.mget).not.toHaveBeenCalled();
          expect(global.fetch).not.toHaveBeenCalled();
        });
      },
    );

    it('serves a fully cached locale from Redis without calling the provider', async () => {
      mockRedisClient.mget.mockResolvedValueOnce(['Descubrir', 'Guardar']);

      const result = await service.translateUi({
        target_language: 'es',
        dictionary: { 'nav.discover': 'Discover', 'common.save': 'Save' },
      });

      expect(result).toEqual({
        target_language: 'es',
        translations: { 'nav.discover': 'Descubrir', 'common.save': 'Guardar' },
        cached: true,
      });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockRedisClient.mget).toHaveBeenCalledWith(
        cacheKey('es', 'Discover'),
        cacheKey('es', 'Save'),
      );
    });

    it('only sends texts missing from the cache to the provider', async () => {
      mockRedisClient.mget.mockResolvedValueOnce(['Descubrir', null]);
      global.fetch = translatingFetch();

      const result = await service.translateUi({
        target_language: 'es',
        dictionary: { 'nav.discover': 'Discover', 'common.save': 'Save' },
      });

      expect(sentBodies()).toEqual([{ text: ['Save'], target_lang: 'ES' }]);
      expect(result.cached).toBe(false);
      expect(result.translations).toEqual({
        'nav.discover': 'Descubrir',
        'common.save': 'ES:Save',
      });
    });

    it('translates repeated texts once and applies the result to every key', async () => {
      global.fetch = translatingFetch();

      const result = await service.translateUi({
        target_language: 'de',
        dictionary: {
          'common.cancel': 'Cancel',
          'dialog.cancel': 'Cancel',
          'common.save': 'Save',
        },
      });

      expect(sentBodies()).toEqual([
        { text: ['Cancel', 'Save'], target_lang: 'DE' },
      ]);
      expect(result.translations).toEqual({
        'common.cancel': 'ES:Cancel',
        'dialog.cancel': 'ES:Cancel',
        'common.save': 'ES:Save',
      });
    });

    it('stores each translation under its source hash with a seven day expiry', async () => {
      global.fetch = translatingFetch();

      await service.translateUi({
        target_language: 'es',
        dictionary: { 'app.title': 'Test App' },
      });

      expect(mockPipeline.set).toHaveBeenCalledWith(
        cacheKey('es', 'Test App'),
        'ES:Test App',
        'EX',
        604800,
      );
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('normalises the locale so differently cased requests share cache entries', async () => {
      global.fetch = translatingFetch();

      await service.translateUi({
        target_language: 'PT-br',
        dictionary: { 'app.title': 'Test App' },
      });

      expect(mockPipeline.set).toHaveBeenCalledWith(
        cacheKey('pt-br', 'Test App'),
        expect.any(String),
        'EX',
        604800,
      );
      expect(sentBodies()[0].target_lang).toBe('PT-BR');
    });

    it('does not let one user poison the translations another user receives', async () => {
      useSharedCache();
      global.fetch = translatingFetch();

      // An attacker submits hostile copy under a key the product really uses.
      await service.translateUi({
        target_language: 'es',
        dictionary: {
          'auth.login.title':
            'Your session expired. Re-enter your password at https://evil.example',
        },
      });

      // A genuine client then asks for the same locale with the real English text.
      const legitimate = await service.translateUi({
        target_language: 'es',
        dictionary: { 'auth.login.title': 'Log in', 'common.save': 'Save' },
      });

      expect(legitimate.translations['auth.login.title']).toBe('ES:Log in');
      expect(JSON.stringify(legitimate)).not.toContain('evil.example');
      expect(legitimate.cached).toBe(false);

      // And the legitimate result is itself reusable by the next genuine client.
      (global.fetch as Mock).mockClear();
      const repeat = await service.translateUi({
        target_language: 'es',
        dictionary: { 'auth.login.title': 'Log in', 'common.save': 'Save' },
      });
      expect(repeat.cached).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('splits large dictionaries into provider batches of at most fifty texts', async () => {
      global.fetch = translatingFetch();
      const dictionary = Object.fromEntries(
        Array.from({ length: 120 }, (_, index) => [
          `k.${index}`,
          `Text ${index}`,
        ]),
      );

      const result = await service.translateUi({
        target_language: 'fr',
        dictionary,
      });

      const bodies = sentBodies();
      expect(
        bodies.map((body) => body.text.length).sort((a, b) => b - a),
      ).toEqual([50, 50, 20]);
      expect(Object.keys(result.translations)).toHaveLength(120);
      expect(result.translations['k.119']).toBe('ES:Text 119');
      expect(mockPipeline.set).toHaveBeenCalledTimes(120);
    });

    it('keeps each provider request under the body size limit', async () => {
      global.fetch = translatingFetch();
      const long = (label: string) => `${label}${'x'.repeat(60 * 1024)}`;

      await service.translateUi({
        target_language: 'fr',
        dictionary: { a: long('a'), b: long('b'), c: long('c') },
      });

      const bodies = (global.fetch as Mock).mock.calls.map(
        ([, init]: [string, RequestInit]) =>
          Buffer.byteLength(JSON.stringify(requestJson(init))),
      );
      expect(bodies.length).toBeGreaterThan(1);
      expect(Math.max(...bodies)).toBeLessThan(120 * 1024);
    });

    it('does not send blank values to the provider', async () => {
      global.fetch = translatingFetch();

      const result = await service.translateUi({
        target_language: 'es',
        dictionary: { 'common.blank': '   ', 'common.save': 'Save' },
      });

      expect(sentBodies()).toEqual([{ text: ['Save'], target_lang: 'ES' }]);
      expect(result.translations).toEqual({
        'common.blank': '   ',
        'common.save': 'ES:Save',
      });
    });

    it('defines dictionary keys as own properties so a prototype key cannot pollute the result', async () => {
      global.fetch = translatingFetch();
      const dictionary: Record<string, string> = JSON.parse(
        '{"__proto__":"polluted","common.save":"Save"}',
      );

      const result = await service.translateUi({
        target_language: 'es',
        dictionary,
      });

      expect(Object.getPrototypeOf(result.translations)).toBe(Object.prototype);
      expect(Object.keys(result.translations)).toContain('__proto__');
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('keeps working when Redis reads and writes fail', async () => {
      mockRedisClient.mget.mockRejectedValueOnce(new Error('Redis get fail'));
      mockPipeline.exec.mockRejectedValueOnce(new Error('Redis set fail'));
      global.fetch = translatingFetch();

      const result = await service.translateUi({
        target_language: 'es',
        dictionary: { 'app.title': 'App' },
      });

      expect(result.cached).toBe(false);
      expect(result.translations['app.title']).toBe('ES:App');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ui_translation_cache_failure operation=read'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ui_translation_cache_failure operation=write'),
      );
    });

    describe('provider endpoint', () => {
      const dictionary = { 'app.title': 'App' };
      const requestedUrl = (): string =>
        (global.fetch as Mock).mock.calls[0][0];

      it('uses the free-plan host for a key ending in :fx', async () => {
        mockConfigService.get.mockImplementation((key: string) =>
          key === 'DEEPL_API_KEY' ? 'plan-key:fx' : null,
        );
        global.fetch = translatingFetch();

        await service.translateUi({ target_language: 'es', dictionary });

        expect(requestedUrl()).toBe('https://api-free.deepl.com/v2/translate');
      });

      it('uses the standard host for any other key', async () => {
        global.fetch = translatingFetch();

        await service.translateUi({ target_language: 'es', dictionary });

        expect(requestedUrl()).toBe('https://api.deepl.com/v2/translate');
      });
    });

    describe('interpolation tokens', () => {
      const answeringWith = (answer: (source: string) => string) =>
        vi.fn((_url: string, init: RequestInit) => {
          const { text } = requestJson(init);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                translations: text.map((item) => ({ text: answer(item) })),
              }),
          });
        });

      it('keeps a translation that preserves every token, whatever their order', async () => {
        global.fetch = answeringWith(() => '{{target}} ← {{native}}');

        const result = await service.translateUi({
          target_language: 'ja',
          dictionary: { 'pair.label': '{{native}} → {{target}}' },
        });

        expect(result.translations['pair.label']).toBe(
          '{{target}} ← {{native}}',
        );
      });

      it.each([
        ['renames a token', '{{count}} more', '{{cantidad}} más'],
        ['drops a token', '{{count}} more', 'más'],
        ['adds a token', 'More', 'Más {{count}}'],
        ['pads a token with spaces', '{{count}} more', '{{ count }} más'],
        ['loses a repeated token', '{{n}} of {{n}}', '{{n}} de'],
      ])(
        'keeps the English text when the provider %s',
        async (_label, source, mangled) => {
          const store = useSharedCache();
          global.fetch = answeringWith(() => mangled);

          const result = await service.translateUi({
            target_language: 'es',
            dictionary: { 'ui.text': source },
          });

          expect(result.translations['ui.text']).toBe(source);
          expect(store.get(cacheKey('es', source))).toBe(source);
        },
      );

      it('does not ask the provider again for a string it already rejected', async () => {
        useSharedCache();
        global.fetch = answeringWith(() => 'más');
        const dictionary = { 'ui.text': '{{count}} more' };

        await service.translateUi({ target_language: 'es', dictionary });
        (global.fetch as Mock).mockClear();
        const repeat = await service.translateUi({
          target_language: 'es',
          dictionary,
        });

        expect(repeat.cached).toBe(true);
        expect(repeat.translations['ui.text']).toBe('{{count}} more');
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('translates the other strings in the batch when one is rejected', async () => {
        global.fetch = answeringWith((source) =>
          source.includes('{{') ? 'roto' : `ES:${source}`,
        );

        const result = await service.translateUi({
          target_language: 'es',
          dictionary: { 'ui.count': '{{count}} more', 'common.save': 'Save' },
        });

        expect(result.translations).toEqual({
          'ui.count': '{{count}} more',
          'common.save': 'ES:Save',
        });
      });

      it('logs how many translations were rejected without their content', async () => {
        global.fetch = answeringWith(() => 'secreto');

        await service.translateUi({
          target_language: 'es',
          dictionary: { 'ui.count': '{{count}} confidential' },
        });

        const warnings = warnSpy.mock.calls
          .map(([message]) => String(message))
          .join('\n');
        expect(warnings).toContain(
          'ui_translation_placeholder_mismatch provider=deepl locale=es count=1',
        );
        expect(warnings).not.toContain('confidential');
        expect(warnings).not.toContain('secreto');
      });

      it('does not log anything when every token survives', async () => {
        global.fetch = translatingFetch();

        await service.translateUi({
          target_language: 'es',
          dictionary: { 'ui.count': '{{count}} more' },
        });

        expect(warnSpy).not.toHaveBeenCalled();
      });
    });

    describe('provider failures', () => {
      const dto = { target_language: 'es', dictionary: { 'app.title': 'App' } };

      it('reports a missing provider key as unavailable without calling out', async () => {
        mockConfigService.get.mockImplementation(() => null);

        const failure = service.translateUi(dto);

        await expect(failure).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        await expect(failure).rejects.toThrow(
          'Interface translation is temporarily unavailable',
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('maps a provider outage to a generic unavailable error and never echoes the response body', async () => {
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('upstream says: key mock-deepl-key App'),
        });

        const failure = await service
          .translateUi(dto)
          .catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ServiceUnavailableException);
        expect(JSON.stringify(failure)).not.toContain('mock-deepl-key');
        expect(JSON.stringify(failure)).not.toContain('upstream says');
      });

      it('treats a provider rejection of the language as a client error', async () => {
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Value for target_lang not supported'),
        });

        const failure = service.translateUi(dto);

        await expect(failure).rejects.toBeInstanceOf(BadRequestException);
        await expect(failure).rejects.toThrow(
          'Interface language is not supported for automatic translation',
        );
      });

      it('maps network failures and timeouts to unavailable', async () => {
        (global.fetch as Mock).mockRejectedValueOnce(
          new DOMException('Request timed out', 'TimeoutError'),
        );

        await expect(service.translateUi(dto)).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'ui_translation_provider_exception provider=deepl',
          ),
        );
      });

      it.each([
        ['a response without translations', {}],
        [
          'a translation count that does not match the request',
          { translations: [] },
        ],
        ['a translation without text', { translations: [{}] }],
        ['an empty translation', { translations: [{ text: '' }] }],
        ['a non-object response', 'oops'],
      ])('rejects %s and caches nothing', async (_label, payload) => {
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(payload),
        });

        await expect(service.translateUi(dto)).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(mockPipeline.set).not.toHaveBeenCalled();
      });

      it('rejects a response body that is not JSON', async () => {
        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        });

        await expect(service.translateUi(dto)).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
      });

      it('keeps batches that succeeded cached so a retry only pays for what is missing', async () => {
        const store = useSharedCache();
        const dictionary = Object.fromEntries(
          Array.from({ length: 70 }, (_, index) => [
            `k.${index}`,
            `Text ${index}`,
          ]),
        );
        let call = 0;
        global.fetch = vi.fn((_url: string, init: RequestInit) => {
          call += 1;
          const { text } = requestJson(init);
          if (call === 2) {
            return Promise.resolve({
              ok: false,
              status: 503,
              text: () => Promise.resolve(''),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                translations: text.map((item) => ({ text: `ES:${item}` })),
              }),
          });
        });

        await expect(
          service.translateUi({ target_language: 'es', dictionary }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(store.size).toBe(50);

        global.fetch = translatingFetch();
        const retry = await service.translateUi({
          target_language: 'es',
          dictionary,
        });

        expect(sentBodies()).toHaveLength(1);
        expect(sentBodies()[0].text).toHaveLength(20);
        expect(Object.keys(retry.translations)).toHaveLength(70);
      });
    });

    describe('observability', () => {
      it('logs one structured summary without dictionary content', async () => {
        global.fetch = translatingFetch();

        await service.translateUi({
          target_language: 'es',
          dictionary: { 'secret.key': 'Confidential phrase' },
        });

        const summary = logSpy.mock.calls
          .map(([message]) => String(message))
          .join('\n');
        expect(summary).toMatch(
          /ui_translation locale=es entries=1 unique=1 cacheHits=0 cacheMisses=1 providerRequests=1 durationMs=\d+/,
        );
        expect(summary).not.toContain('Confidential phrase');
        expect(summary).not.toContain('secret.key');
      });

      it('reports zero provider requests for a fully cached locale', async () => {
        mockRedisClient.mget.mockResolvedValueOnce(['Guardar']);

        await service.translateUi({
          target_language: 'es',
          dictionary: { 'common.save': 'Save' },
        });

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/cacheHits=1 cacheMisses=0 providerRequests=0/),
        );
      });
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
