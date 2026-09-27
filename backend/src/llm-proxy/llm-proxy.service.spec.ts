import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { LlmProxyService } from './llm-proxy.service';

describe('LlmProxyService', () => {
  const settings: Record<string, string | undefined> = {};
  let fetchMock: Mock;
  let service: LlmProxyService;

  function providerReply(content: string) {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: { content } }] }),
    };
  }

  function requestInit(): RequestInit {
    return fetchMock.mock.calls[0][1] as RequestInit;
  }

  function requestPayload(): {
    model: string;
    messages: unknown[];
    max_tokens: number;
  } {
    return JSON.parse(requestInit().body as string) as {
      model: string;
      messages: unknown[];
      max_tokens: number;
    };
  }

  beforeEach(() => {
    for (const key of Object.keys(settings)) delete settings[key];
    fetchMock = vi.fn().mockResolvedValue(providerReply('hello'));
    vi.stubGlobal('fetch', fetchMock);
    service = new LlmProxyService({
      get: vi.fn((key: string, fallback?: string) => settings[key] ?? fallback),
    } as unknown as ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('chatCompletion', () => {
    it('posts the messages to the default provider with the historical 500 token budget', async () => {
      const messages = [
        { role: 'system' as const, content: 'Be brief.' },
        { role: 'user' as const, content: 'Hi' },
      ];

      const reply = await service.chatCompletion(messages);

      expect(reply).toBe('hello');
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.openai.com/v1/chat/completions',
      );
      expect(requestInit().method).toBe('POST');
      expect(requestPayload()).toEqual({
        model: 'gpt-4',
        messages,
        max_tokens: 500,
      });
    });

    it('uses the configured provider URL, model and bearer key', async () => {
      settings.LLM_API_URL = 'https://llm.internal.example/v1/chat';
      settings.LLM_MODEL = 'house-model';
      settings.LLM_API_KEY = 'secret-key';

      await service.chatCompletion([{ role: 'user', content: 'Hi' }]);

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://llm.internal.example/v1/chat',
      );
      expect(requestPayload().model).toBe('house-model');
      expect(requestInit().headers).toMatchObject({
        Authorization: 'Bearer secret-key',
        'Content-Type': 'application/json',
      });
    });

    it('omits the Authorization header when no key is configured', async () => {
      await service.chatCompletion([{ role: 'user', content: 'Hi' }]);

      expect(requestInit().headers).not.toHaveProperty('Authorization');
    });

    it('lets a caller raise the token budget for longer completions', async () => {
      await service.chatCompletion([{ role: 'user', content: 'Hi' }], {
        maxTokens: 2_500,
      });

      expect(requestPayload().max_tokens).toBe(2_500);
    });

    it('forwards the caller abort signal to the upstream request', async () => {
      const controller = new AbortController();

      await service.chatCompletion([{ role: 'user', content: 'Hi' }], {
        signal: controller.signal,
      });

      expect(requestInit().signal).toBe(controller.signal);
    });

    it('rejects with the abort error when the upstream request is cancelled', async () => {
      const controller = new AbortController();
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      );

      const pending = service.chatCompletion(
        [{ role: 'user', content: 'Hi' }],
        {
          signal: controller.signal,
        },
      );
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('rejects a non-success provider response without parsing its body', async () => {
      const json = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'A misleading completion' } }],
      });
      fetchMock.mockResolvedValue({ ok: false, status: 429, json });

      await expect(
        service.chatCompletion([{ role: 'user', content: 'Hi' }]),
      ).rejects.toMatchObject({
        name: 'LlmProviderHttpError',
        message: 'LLM provider returned HTTP 429',
      });
      expect(json).not.toHaveBeenCalled();
    });

    it('returns an empty string when the provider reply has no completion', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });

      await expect(
        service.chatCompletion([{ role: 'user', content: 'Hi' }]),
      ).resolves.toBe('');
    });
  });

  describe('proxyMessage', () => {
    it('wraps the text in a single user message and returns the reply', async () => {
      const result = await service.proxyMessage('Translate this');

      expect(result).toEqual({ response: 'hello' });
      expect(requestPayload().messages).toEqual([
        { role: 'user', content: 'Translate this' },
      ]);
    });

    it('passes completion options through to the provider request', async () => {
      const controller = new AbortController();

      await service.proxyMessage('Translate this', {
        maxTokens: 1_200,
        signal: controller.signal,
      });

      expect(requestPayload().max_tokens).toBe(1_200);
      expect(requestInit().signal).toBe(controller.signal);
    });
  });
});
