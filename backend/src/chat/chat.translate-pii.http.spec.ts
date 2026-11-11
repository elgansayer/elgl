import type { Mock } from 'vitest';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { API_GLOBAL_PREFIX, registerBodyParsers } from '../config/body-parsers';
import { FavouritesService } from '../favourites/favourites.service';
import { CentrifugoService } from './centrifugo.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationStarterService } from './conversation-starter.service';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';
import { ReadReceiptsService } from './read-receipts.service';
import { TranslationService } from './translation.service';

/**
 * Boots the real chat controller and the real translation service the way main.ts
 * does, with only DeepL's network replaced, so the privacy contract is checked over
 * HTTP: chat text reaches DeepL without its sensitive values, and the response still
 * carries them.
 */
describe('PII scrubbing for /api/chat translation over HTTP', () => {
  const email = 'john.doe@example.com';
  const phone = '+44 7700 900123';
  const logger = { warn: vi.fn(), debug: vi.fn() };

  let app: INestApplication;

  function formOf(callIndex: number): URLSearchParams {
    const [, init] = (global.fetch as Mock).mock.calls[callIndex] as [
      string,
      RequestInit,
    ];
    return new URLSearchParams(typeof init.body === 'string' ? init.body : '');
  }

  function expectNoSensitiveData(callIndex: number): void {
    const body = formOf(callIndex).toString();
    for (const sensitive of ['john', 'example.com', '7700', '900123']) {
      expect(body).not.toContain(sensitive);
    }
  }

  /**
   * Mimics DeepL: a request with a `source_lang` is a translation and gets `rewrite`
   * applied to the words, any other request is language detection. Placeholders are
   * kept intact unless `dropPlaceholders` is set.
   */
  function mockDeepL(options: {
    rewrite?: (text: string) => string;
    dropPlaceholders?: boolean;
  }): void {
    global.fetch = vi.fn((_url: string, init: RequestInit) => {
      const form = new URLSearchParams(
        typeof init.body === 'string' ? init.body : '',
      );
      const sent = form.get('text') ?? '';
      const isTranslation = form.has('source_lang');
      const text =
        isTranslation && options.dropPlaceholders
          ? 'Contáctame mañana'
          : isTranslation
            ? (options.rewrite?.(sent) ?? sent)
            : sent;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            translations: [{ detected_source_language: 'EN', text }],
          }),
      });
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        TranslationService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'DEEPL_API_KEY' ? 'deepl-test:fx' : undefined,
          },
        },
        { provide: 'PinoLogger:TranslationService', useValue: logger },
        { provide: ChatService, useValue: {} },
        { provide: FavouritesService, useValue: {} },
        { provide: CentrifugoService, useValue: {} },
        { provide: ConversationStarterService, useValue: {} },
        { provide: PersonalChatEncryptionService, useValue: {} },
        { provide: ReadReceiptsService, useValue: {} },
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

  describe('POST /api/chat/translate-voiceroom', () => {
    it('detects and translates from masked text and returns the values restored', async () => {
      mockDeepL({
        rewrite: (text) =>
          text
            .replace('Contact me at', 'Contáctame en')
            .replace('or call', 'o llama al'),
      });

      const response = await request(app.getHttpServer())
        .post('/api/chat/translate-voiceroom')
        .send({
          text: `Contact me at ${email} or call ${phone}`,
          target_language: 'es',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        translated_text: `Contáctame en ${email} o llama al ${phone}`,
        detected_language: 'en',
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
      expect(formOf(1).get('text')).toMatch(
        /^Contact me at PII[A-Z]{8}0Z or call PII[A-Z]{8}1Z$/,
      );
    });

    it('shows the source text when DeepL damages a placeholder', async () => {
      mockDeepL({ dropPlaceholders: true });
      const message = `Contact me at ${email} tomorrow`;

      const response = await request(app.getHttpServer())
        .post('/api/chat/translate-voiceroom')
        .send({ text: message, target_language: 'es' });

      expect(response.status).toBe(201);
      expect(response.body.translated_text).toBe(message);
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
    });

    it('makes no DeepL call for a message that is only sensitive data', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/chat/translate-voiceroom')
        .send({ text: email, target_language: 'es' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        translated_text: email,
        detected_language: 'en',
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/translate-real-time', () => {
    it('translates masked text and echoes the original with the values intact', async () => {
      mockDeepL({
        rewrite: (text) => text.replace('Contact me at', 'Contáctame en'),
      });
      const message = `Contact me at ${email}`;

      const response = await request(app.getHttpServer())
        .post('/api/chat/translate-real-time')
        .send({ text: message, target_language: 'es' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        original_text: message,
        translated_text: `Contáctame en ${email}`,
        target_language: 'es',
        detected_language: 'en',
      });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expectNoSensitiveData(0);
      expectNoSensitiveData(1);
    });
  });
});
