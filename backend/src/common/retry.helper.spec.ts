import { withRetry } from './retry.helper';

describe('withRetry', () => {
  it('should return the result on first success', async () => {
    const result = await withRetry(() =>
      Promise.resolve({ data: { ok: true }, status: 200 }),
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
  });

  it('should retry on 429 status and succeed on second attempt', async () => {
    let calls = 0;

    const result = await withRetry(
      () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve({ data: null, status: 429, headers: {} });
        }
        return Promise.resolve({ data: { ok: true }, status: 200 });
      },
      { maxRetries: 3, initialDelayMs: 1 },
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
    expect(calls).toBe(2);
  });

  it('should retry on 503 status', async () => {
    let calls = 0;

    const result = await withRetry(
      () => {
        calls++;
        if (calls < 3) {
          return Promise.resolve({ data: null, status: 503, headers: {} });
        }
        return Promise.resolve({ data: { ok: true }, status: 200 });
      },
      { maxRetries: 5, initialDelayMs: 1 },
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
    expect(calls).toBe(3);
  });

  it('should throw after all retries exhausted', async () => {
    let calls = 0;

    const promise = withRetry(
      () => {
        calls++;
        return Promise.resolve({ data: null, status: 429, headers: {} });
      },
      { maxRetries: 2, initialDelayMs: 1 },
    );

    await expect(promise).rejects.toThrow(
      'Request failed with status 429 after 3 attempts',
    );
    expect(calls).toBe(3);
  });

  it('should respect Retry-After header (seconds)', async () => {
    let calls = 0;

    const result = await withRetry(
      () => {
        calls++;
        if (calls === 1) {
          return Promise.resolve({
            data: null,
            status: 429,
            headers: { 'retry-after': '0' },
          });
        }
        return Promise.resolve({ data: { ok: true }, status: 200 });
      },
      { maxRetries: 3, initialDelayMs: 1 },
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
    expect(calls).toBe(2);
  });

  it('should cap delay at maxDelayMs', async () => {
    let calls = 0;

    const result = await withRetry(
      () => {
        calls++;
        if (calls < 3) {
          return Promise.resolve({ data: null, status: 429, headers: {} });
        }
        return Promise.resolve({ data: { ok: true }, status: 200 });
      },
      { maxRetries: 5, initialDelayMs: 1, maxDelayMs: 10 },
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
    expect(calls).toBe(3);
  });

  it('should retry on thrown errors (network failures)', async () => {
    let calls = 0;

    const result = await withRetry(
      () => {
        calls++;
        if (calls < 2) {
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve({ data: { ok: true }, status: 200 });
      },
      { maxRetries: 3, initialDelayMs: 1 },
    );

    expect(result).toEqual({ data: { ok: true }, status: 200 });
    expect(calls).toBe(2);
  });

  it('should throw the last error after all retries exhausted on thrown errors', async () => {
    let calls = 0;

    const promise = withRetry(
      () => {
        calls++;
        return Promise.reject(new Error('ECONNREFUSED'));
      },
      { maxRetries: 1, initialDelayMs: 1 },
    );

    await expect(promise).rejects.toThrow('ECONNREFUSED');
    expect(calls).toBe(2);
  });
});