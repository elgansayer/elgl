import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;
  let configService: ConfigService;
  let logger: PinoLogger;

  const mockConfigService = {
    get: vi.fn((key: string) => {
      if (key === 'DEEPL_API_KEY') return 'test-api-key';
      return null;
    }),
  };

  const mockLogger = {
    warn: vi.fn(),
  };

  beforeEach(async () => {
    // Clear mocks before each test
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PinoLogger, useValue: mockLogger },
        { provide: 'PinoLogger:TranslationService', useValue: mockLogger },
      ],
    }).compile();

    service = module.get<TranslationService>(TranslationService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<PinoLogger>(PinoLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectLanguage', () => {
    it('should return "en" if DEEPL_API_KEY is missing', async () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      const serviceWithoutKey = new TranslationService(configService, logger);

      const result = await serviceWithoutKey.detectLanguage('Hola');
      expect(result).toBe('en');
    });

    it('should return "en" if text is empty', async () => {
      const result = await service.detectLanguage('   ');
      expect(result).toBe('en');
    });

    it('should return cached language if available', async () => {
      // First call to populate cache
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translations: [{ detected_source_language: 'es' }],
        }),
      });

      await service.detectLanguage('Hola');

      // Second call, should not trigger fetch
      global.fetch = vi.fn();
      const result = await service.detectLanguage('Hola');

      expect(result).toBe('es');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should detect language via fetch and cache the result', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translations: [{ detected_source_language: 'fr' }],
        }),
      });

      const result = await service.detectLanguage('Bonjour');
      expect(result).toBe('fr');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fallback to "en" and log warn if fetch fails (!ok)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const result = await service.detectLanguage('Bonjour');
      expect(result).toBe('en');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should fallback to "en" if translations array is missing or empty', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translations: [] }),
      });

      const result = await service.detectLanguage('Bonjour');
      expect(result).toBe('en');
    });

    it('should fallback to "en" and log warn if fetch throws error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await service.detectLanguage('Bonjour');
      expect(result).toBe('en');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('translate', () => {
    it('should return original text if DEEPL_API_KEY is missing', async () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      const serviceWithoutKey = new TranslationService(configService, logger);

      const result = await serviceWithoutKey.translate('Hello', 'en', 'es');
      expect(result).toBe('Hello');
    });

    it('should return cached translation if available', async () => {
      // First call to populate cache
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Hola' }],
        }),
      });

      await service.translate('Hello', 'en', 'es');

      // Second call, should not trigger fetch
      global.fetch = vi.fn();
      const result = await service.translate('Hello', 'en', 'es');

      expect(result).toBe('Hola');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should translate text via fetch and cache the result', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Bonjour' }],
        }),
      });

      const result = await service.translate('Hello', 'en', 'fr');
      expect(result).toBe('Bonjour');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return original text and log warn if fetch fails (!ok)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.translate('Hello', 'en', 'fr');
      expect(result).toBe('Hello');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return original text and log warn if fetch throws error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API error'));

      const result = await service.translate('Hello', 'en', 'fr');
      expect(result).toBe('Hello');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('translateWithDetection', () => {
    it('should detect language and translate text', async () => {
      vi.spyOn(service, 'detectLanguage').mockResolvedValueOnce('en');
      vi.spyOn(service, 'translate').mockResolvedValueOnce('Hola');

      const result = await service.translateWithDetection('Hello', 'es');

      expect(result).toEqual({
        translatedText: 'Hola',
        detectedLanguage: 'en',
      });
      expect(service.detectLanguage).toHaveBeenCalledWith('Hello');
      expect(service.translate).toHaveBeenCalledWith('Hello', 'en', 'es');
    });
  });

  describe('translateWithExplanations', () => {
    it('should return primary translation, alternatives and context explanation', async () => {
      vi.spyOn(service, 'translate')
        .mockResolvedValueOnce('Hola') // Primary translation
        .mockResolvedValueOnce('Hello'); // Reverse translation

      const result = await service.translateWithExplanations(
        'Hello',
        'en',
        'es',
      );

      expect(result).toEqual({
        translation: 'Hola',
        alternatives: ['Hola', '(more formal) Hola', '(more colloquial) Hello'],
        contextExplanation: expect.stringContaining(
          '"Hello" is a phrase in en that',
        ),
      });

      expect(service.translate).toHaveBeenCalledTimes(2);
      expect(service.translate).toHaveBeenNthCalledWith(1, 'Hello', 'en', 'es');
      expect(service.translate).toHaveBeenNthCalledWith(2, 'Hola', 'es', 'en');
    });
  });
});
