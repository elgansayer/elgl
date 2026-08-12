import type { Mock } from 'vitest';
import { fetchWithExponentialBackoff } from './exponential-backoff';

const originalFetch = global.fetch;

describe('fetchWithExponentialBackoff', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('should return immediately on a successful 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ translated_text: 'hello' }),
    });

    const response = await fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ translated_text: 'hello' });
  });

  it('should retry on HTTP 429 and succeed on the second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 429,
        headers: new Headers(),
        json: async () => ({ error: 'rate limited' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ translated_text: 'bonjour' }),
      });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 3, baseDelayMs: 1000 },
    );

    await vi.advanceTimersByTimeAsync(5000);
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it('should exhaust all retries and return the last 429 response', async () => {
    mockFetch.mockResolvedValue({
      status: 429,
      headers: new Headers(),
      json: async () => ({ error: 'rate limited' }),
    });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 2, baseDelayMs: 100 },
    );

    await vi.advanceTimersByTimeAsync(10000);
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(response.status).toBe(429);
  });

  it('should respect Retry-After header when present', async () => {
    const headers = new Headers();
    headers.set('Retry-After', '2');

    mockFetch
      .mockResolvedValueOnce({
        status: 429,
        headers,
        json: async () => ({ error: 'rate limited' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true }),
      });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 3, baseDelayMs: 1000 },
    );

    await vi.advanceTimersByTimeAsync(3000);
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it('should respect custom retryable statuses', async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 503,
        headers: new Headers(),
        json: async () => ({ error: 'service unavailable' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true }),
      });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 2, baseDelayMs: 100, retryableStatuses: [429, 503] },
    );

    await vi.advanceTimersByTimeAsync(5000);
    const response = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it('should not retry on client errors 4xx except 429 by default', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      json: async () => ({ error: 'bad request' }),
    });

    const response = await fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
  });

  it('should exponentially increase delay between retries', async () => {
    mockFetch.mockResolvedValue({
      status: 429,
      headers: new Headers(),
      json: async () => ({ error: 'rate limited' }),
    });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 60000 },
    );

    await vi.advanceTimersByTimeAsync(20000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('should cap delay at maxDelayMs', async () => {
    mockFetch.mockResolvedValue({
      status: 429,
      headers: new Headers(),
      json: async () => ({ error: 'rate limited' }),
    });

    const promise = fetchWithExponentialBackoff(
      'https://api.example.com/translate',
      { method: 'POST' },
      { maxRetries: 5, baseDelayMs: 32000, maxDelayMs: 60000 },
    );

    await vi.advanceTimersByTimeAsync(400000);
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
});
