import { ServiceUnavailableException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import type {
  ChatCompletionOptions,
  LlmProxyService,
} from '../llm-proxy/llm-proxy.service';
import type { MetricsService } from '../metrics/metrics.service';
import { GrammarCheckService } from './grammar-check.service';

describe('GrammarCheckService', () => {
  let chatCompletion: ReturnType<typeof vi.fn>;
  let logWarning: ReturnType<typeof vi.fn>;
  let recordRequest: ReturnType<typeof vi.fn>;
  let recordDuration: ReturnType<typeof vi.fn>;
  let recordError: ReturnType<typeof vi.fn>;
  let service: GrammarCheckService;

  beforeEach(() => {
    chatCompletion = vi.fn();
    logWarning = vi.fn();
    recordRequest = vi.fn();
    recordDuration = vi.fn();
    recordError = vi.fn();
    service = new GrammarCheckService(
      { chatCompletion } as unknown as LlmProxyService,
      { warn: logWarning } as unknown as PinoLogger,
      {
        recordReadingEngineAiRequest: recordRequest,
        recordReadingEngineAiRequestDuration: recordDuration,
        recordReadingEngineAiError: recordError,
      } as unknown as MetricsService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a bounded correction from the configured LLM', async () => {
    chatCompletion.mockResolvedValue(
      JSON.stringify({
        corrected: 'I went to the shop yesterday.',
        explanation: 'Use the past tense and add the article.',
        errors_found: 2,
      }),
    );

    const result = await service.check({
      text: 'I go shop yesterday.',
      language: 'en-GB',
    });

    expect(result).toEqual({
      original: 'I go shop yesterday.',
      corrected: 'I went to the shop yesterday.',
      explanation: 'Use the past tense and add the article.',
      errors_found: 2,
    });
    expect(chatCompletion).toHaveBeenCalledOnce();
    const [messages, options] = chatCompletion.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      ChatCompletionOptions,
    ];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('untrusted user content');
    expect(messages[0].content).not.toContain('I go shop yesterday.');
    expect(JSON.parse(messages[1].content)).toEqual({
      language: 'en-GB',
      text: 'I go shop yesterday.',
    });
    expect(options.maxTokens).toBe(540);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(recordRequest).toHaveBeenCalledWith('grammar-check', 'success');
    expect(recordDuration).toHaveBeenCalledWith(
      'grammar-check',
      expect.any(Number),
    );
  });

  it('accepts fenced JSON but never trusts a provider supplied original value', async () => {
    chatCompletion.mockResolvedValue(
      '```json\n{"original":"different","corrected":"Safe sentence.","explanation":"Fixed punctuation.","errors_found":1}\n```',
    );

    const result = await service.check({ text: 'Safe sentence' });

    expect(result.original).toBe('Safe sentence');
    expect(result.corrected).toBe('Safe sentence.');
    expect(result.errors_found).toBe(1);
  });

  it('normalises unchanged responses to zero errors', async () => {
    chatCompletion.mockResolvedValue(
      JSON.stringify({
        corrected: 'Already correct.',
        explanation: '',
        errors_found: 12,
      }),
    );

    const result = await service.check({ text: 'Already correct.' });

    expect(result).toEqual({
      original: 'Already correct.',
      corrected: 'Already correct.',
      explanation: 'No grammar changes suggested.',
      errors_found: 0,
    });
  });

  it('requires at least one reported error whenever the text changes', async () => {
    chatCompletion.mockResolvedValue(
      JSON.stringify({
        corrected: 'Changed.',
        explanation: 'Punctuation.',
        errors_found: 0,
      }),
    );

    const result = await service.check({ text: 'Changed' });

    expect(result.errors_found).toBe(1);
  });

  it.each([
    ['provider failure', new Error('provider unavailable')],
    ['invalid JSON', 'not json'],
    [
      'invalid schema',
      JSON.stringify({
        corrected: 42,
        explanation: 'bad schema',
        errors_found: 1,
      }),
    ],
  ])(
    'fails closed when the %s cannot produce a trustworthy result',
    async (_name, outcome) => {
      if (outcome instanceof Error) {
        chatCompletion.mockRejectedValue(outcome);
      } else {
        chatCompletion.mockResolvedValue(outcome);
      }

      await expect(service.check({ text: 'Check this.' })).rejects.toEqual(
        expect.any(ServiceUnavailableException),
      );
    },
  );

  it('does not expose provider errors or user text in the unavailable response', async () => {
    chatCompletion.mockRejectedValue(
      new Error('provider leaked private text: my secret sentence'),
    );

    await expect(
      service.check({ text: 'my secret sentence' }),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        statusCode: 503,
        message: 'Grammar checking is temporarily unavailable',
      },
    });
    expect(recordError).toHaveBeenCalledWith('grammar-check', 'provider_error');
    expect(JSON.stringify(logWarning.mock.calls)).not.toContain(
      'my secret sentence',
    );
  });

  it('caps the output token budget for the longest valid input', async () => {
    const text = 'x'.repeat(2000);
    chatCompletion.mockResolvedValue(
      JSON.stringify({ corrected: text, explanation: '', errors_found: 0 }),
    );

    await service.check({ text });

    const options = chatCompletion.mock.calls[0][1] as ChatCompletionOptions;
    expect(options.maxTokens).toBe(4000);
  });

  it('classifies invalid responses without logging private text', async () => {
    chatCompletion.mockResolvedValue('not json');

    await expect(
      service.check({ text: 'my private sentence', language: 'en-GB' }),
    ).rejects.toEqual(expect.any(ServiceUnavailableException));

    expect(recordError).toHaveBeenCalledWith(
      'grammar-check',
      'invalid_response',
    );
    expect(logWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'grammar_check_failed',
        reason: 'invalid_response',
        detail: 'not_json',
        textLength: 19,
        language: 'en-GB',
      }),
      'Grammar check provider failed',
    );
    expect(JSON.stringify(logWarning.mock.calls)).not.toContain(
      'my private sentence',
    );
  });

  it('aborts and records a timeout when the provider misses its deadline', async () => {
    vi.useFakeTimers();
    let rejectProvider: ((reason: Error) => void) | undefined;
    chatCompletion.mockReturnValue(
      new Promise<string>((_resolve, reject) => {
        rejectProvider = reject;
      }),
    );

    const pending = service.check({ text: 'Wait for this.' });
    const rejection = expect(pending).rejects.toEqual(
      expect.any(ServiceUnavailableException),
    );
    const options = chatCompletion.mock.calls[0][1] as ChatCompletionOptions;
    options.signal?.addEventListener('abort', () => {
      rejectProvider?.(new DOMException('Aborted', 'AbortError'));
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await rejection;
    expect(options.signal?.aborted).toBe(true);
    expect(recordError).toHaveBeenCalledWith('grammar-check', 'timeout');
  });
});
