import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmProxyService } from './llm-proxy.service';

describe('LlmProxyService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards an abort signal to the provider request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Generated response' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new LlmProxyService({
      get: vi.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          LLM_API_KEY: 'test-key',
          LLM_API_URL: 'https://provider.example.test/completions',
          LLM_MODEL: 'test-model',
        };
        return values[key] ?? fallback;
      }),
    } as never);
    const controller = new AbortController();

    await expect(
      service.proxyMessage('Generate this', controller.signal),
    ).resolves.toEqual({ response: 'Generated response' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example.test/completions',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
        body: expect.stringContaining('Generate this'),
      }),
    );
  });

  it('lets callers set a completion budget through options', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Generated response' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new LlmProxyService({
      get: vi.fn((_key: string, fallback?: string) => fallback),
    } as never);
    const controller = new AbortController();

    await service.chatCompletion([{ role: 'user', content: 'Generate this' }], {
      maxTokens: 2400,
      signal: controller.signal,
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(typeof request.body).toBe('string');
    if (typeof request.body !== 'string') {
      throw new Error('Expected a JSON request body');
    }
    expect(JSON.parse(request.body)).toMatchObject({
      max_tokens: 2400,
    });
    expect(request.signal).toBe(controller.signal);
  });

  it('fails closed on provider HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn(),
      }),
    );
    const service = new LlmProxyService({
      get: vi.fn((_key: string, fallback?: string) => fallback),
    } as never);

    await expect(service.proxyMessage('Generate this')).rejects.toMatchObject({
      name: 'LlmProviderHttpError',
      message: 'LLM provider returned HTTP 503',
    });
  });
});
