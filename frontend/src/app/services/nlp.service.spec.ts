import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { NlpService } from './nlp.service';

const response = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('NlpService', () => {
  let service: NlpService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const authService = {
    getAccessToken: vi.fn((): string | null => 'access-token'),
  };

  beforeEach(() => {
    authService.getAccessToken.mockReturnValue('access-token');
    TestBed.configureTestingModule({
      providers: [NlpService, { provide: AuthService, useValue: authService }],
    });
    service = TestBed.inject(NlpService);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the original and corrected text to the authenticated endpoint', async () => {
    fetchSpy.mockResolvedValue(
      response({
        original: 'I has a cat',
        corrected: 'I have a cat',
        explanation: 'Use have with I.',
      }),
    );

    const result = await service.explainGrammar({
      original: '  I has a cat  ',
      corrected: '  I have a cat  ',
    });

    expect(result.explanation).toBe('Use have with I.');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/nlp\/explain-grammar$/);
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      original: 'I has a cat',
      corrected: 'I have a cat',
    });
  });

  it('posts trimmed text to the authenticated simplification endpoint', async () => {
    fetchSpy.mockResolvedValue(
      response({
        original: 'Although it rained, we continued.',
        simplified: 'It rained. We continued.',
      }),
    );

    const result = await service.simplifyText({ text: '  Although it rained, we continued.  ' });

    expect(result.simplified).toBe('It rained. We continued.');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/nlp\/simplify$/);
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Although it rained, we continued.',
    });
  });

  it('rejects overlong simplification input before network I/O', async () => {
    await expect(service.simplifyText({ text: 'a'.repeat(4001) })).rejects.toMatchObject({
      kind: 'request',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects simplification responses that do not correlate to the requested text', async () => {
    fetchSpy.mockResolvedValue(
      response({ original: 'Different sentence', simplified: 'Simple sentence' }),
    );

    await expect(service.simplifyText({ text: 'Complex sentence' })).rejects.toMatchObject({
      kind: 'request',
    });
  });

  it('rejects unexpectedly large simplification responses', async () => {
    fetchSpy.mockResolvedValue(
      response({ original: 'Complex sentence', simplified: 'a'.repeat(8001) }),
    );

    await expect(service.simplifyText({ text: 'Complex sentence' })).rejects.toMatchObject({
      kind: 'request',
    });
  });

  it('rejects blank explanation input before network I/O', async () => {
    await expect(
      service.explainGrammar({ original: '   ', corrected: 'right' }),
    ).rejects.toMatchObject({ kind: 'empty' });
    await expect(
      service.explainGrammar({ original: 'wrong', corrected: '' }),
    ).rejects.toMatchObject({ kind: 'empty' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['original', 'corrected'] as const)(
    'rejects an overlong %s sentence before network I/O',
    async (field) => {
      const request = { original: 'wrong', corrected: 'right', [field]: 'a'.repeat(4001) };

      await expect(service.explainGrammar(request)).rejects.toMatchObject({ kind: 'request' });
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('accepts sentences exactly at the 4000 character limit', async () => {
    const sentence = 'a'.repeat(4000);
    fetchSpy.mockResolvedValue(
      response({ original: sentence, corrected: sentence, explanation: 'Reason' }),
    );

    await expect(
      service.explainGrammar({ original: sentence, corrected: sentence }),
    ).resolves.toMatchObject({ explanation: 'Reason' });
  });

  it.each([
    [400, 'request'],
    [401, 'auth'],
    [403, 'auth'],
    [500, 'request'],
    [503, 'request'],
  ] as const)('maps an explanation HTTP %i response to the %s error kind', async (status, kind) => {
    fetchSpy.mockResolvedValue(response({ message: 'failure' }, status));

    await expect(
      service.explainGrammar({ original: 'wrong', corrected: 'right' }),
    ).rejects.toMatchObject({ kind, status });
  });

  it('classifies rate-limit responses and preserves Retry-After', async () => {
    fetchSpy.mockResolvedValue(
      response({ message: 'Too many requests' }, 429, { 'Retry-After': '17' }),
    );

    await expect(
      service.explainGrammar({ original: 'wrong', corrected: 'right' }),
    ).rejects.toMatchObject({
      kind: 'rate_limit',
      status: 429,
      retryAfterSeconds: 17,
    });
  });

  it('classifies simplify rate limits and preserves Retry-After', async () => {
    fetchSpy.mockResolvedValue(
      response({ message: 'Too many requests' }, 429, { 'Retry-After': '9' }),
    );

    await expect(service.simplifyText({ text: 'Complex sentence' })).rejects.toMatchObject({
      kind: 'rate_limit',
      status: 429,
      retryAfterSeconds: 9,
    });
  });

  it('rejects missing authentication before making a request', async () => {
    authService.getAccessToken.mockReturnValue(null);

    await expect(
      service.explainGrammar({ original: 'wrong', corrected: 'right' }),
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects simplify requests without authentication before fetch', async () => {
    authService.getAccessToken.mockReturnValue(null);

    await expect(service.simplifyText({ text: 'Complex sentence' })).rejects.toMatchObject({
      kind: 'auth',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats blank or malformed explanation responses as empty', async () => {
    fetchSpy.mockResolvedValue(
      response({ original: 'wrong', corrected: 'right', explanation: '   ' }),
    );

    await expect(
      service.explainGrammar({ original: 'wrong', corrected: 'right' }),
    ).rejects.toMatchObject({ kind: 'empty' });
  });

  it('treats blank simplify input and blank responses as empty', async () => {
    await expect(service.simplifyText({ text: '   ' })).rejects.toMatchObject({ kind: 'empty' });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValue(response({ original: 'Complex sentence', simplified: '   ' }));
    await expect(service.simplifyText({ text: 'Complex sentence' })).rejects.toMatchObject({
      kind: 'empty',
    });
  });

  it('passes cancellation to fetch', async () => {
    const controller = new AbortController();
    fetchSpy.mockResolvedValue(
      response({ original: 'wrong', corrected: 'right', explanation: 'Reason' }),
    );

    await service.explainGrammar({ original: 'wrong', corrected: 'right' }, controller.signal);

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('passes simplification cancellation to fetch', async () => {
    const controller = new AbortController();
    fetchSpy.mockResolvedValue(
      response({ original: 'Complex sentence', simplified: 'Simple sentence' }),
    );

    await service.simplifyText({ text: 'Complex sentence' }, controller.signal);

    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});
