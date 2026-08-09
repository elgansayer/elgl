import { withRetry, isRateLimitError } from './retry';

// Mock logger for tests
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as import('nestjs-pino').PinoLogger;

describe('isRateLimitError', () => {
  it('should return true for error with code "429"', () => {
    expect(isRateLimitError({ code: '429' })).toBe(true);
  });

  it('should return true for error with status 429', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it('should return true for error with statusCode 429', () => {
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it('should return true for error with message containing "429"', () => {
    expect(
      isRateLimitError({ message: 'Request failed with status code 429' }),
    ).toBe(true);
  });

  it('should return true for error with message containing "too many requests"', () => {
    expect(isRateLimitError({ message: 'Too Many Requests' })).toBe(true);
    expect(
      isRateLimitError({ message: 'TOO MANY REQUESTS: rate limit exceeded' }),
    ).toBe(true);
  });

  it('should return false for non-429 errors', () => {
    expect(isRateLimitError({ code: '500' })).toBe(false);
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError({ message: 'Internal server error' })).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError('string')).toBe(false);
    expect(isRateLimitError(123)).toBe(false);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    // Mock setTimeout to resolve instantly for deterministic tests
    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn: (...args: unknown[]) => void, _ms?: number) => {
        fn();
        return {} as ReturnType<typeof setTimeout>;
      });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return result on first success without retrying', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withRetry(operation, { logger: mockLogger });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should retry on HTTP 429 errors with exponential backoff', async () => {
    const rateLimitError = { code: '429', message: 'Too Many Requests' };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('success');

    const result = await withRetry(operation, {
      maxRetries: 3,
      baseDelayMs: 500,
      logger: mockLogger,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenCalledWith(
      { attempt: 2, totalAttempts: 3 },
      'Retry succeeded for Supabase operation',
    );
  });

  it('should throw non-429 errors immediately without retrying', async () => {
    const nonRateLimitError = new Error('Database connection failed');
    const operation = jest.fn().mockRejectedValue(nonRateLimitError);

    await expect(withRetry(operation, { logger: mockLogger })).rejects.toThrow(
      'Database connection failed',
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should throw 429 error after exhausting all retries', async () => {
    const rateLimitError = { code: '429' };
    const operation = jest.fn().mockRejectedValue(rateLimitError);

    await expect(
      withRetry(operation, {
        maxRetries: 2,
        baseDelayMs: 100,
        logger: mockLogger,
      }),
    ).rejects.toEqual(rateLimitError);

    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('should retry consecutive 429s until eventual success', async () => {
    const rateLimitError = { code: '429' };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('eventual success');

    const result = await withRetry(operation, {
      maxRetries: 4,
      baseDelayMs: 200,
      logger: mockLogger,
    });

    expect(result).toBe('eventual success');
    expect(operation).toHaveBeenCalledTimes(4);
    expect(mockLogger.warn).toHaveBeenCalledTimes(3);
  });

  it('should use default options when none provided', async () => {
    const rateLimitError = { status: 429 };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('ok');

    const result = await withRetry(operation);

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not log info on retry success when no logger provided', async () => {
    const rateLimitError = { statusCode: 429 };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('ok');

    const result = await withRetry(operation, { baseDelayMs: 100 });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should verify exponential delay values are computed correctly', async () => {
    // Spy on setTimeout to verify the delay values
    jest.restoreAllMocks();
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn: (...args: unknown[]) => void) => {
        fn();
        return {} as ReturnType<typeof setTimeout>;
      });

    const rateLimitError = { code: '429' };
    const operation = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue('ok');

    await withRetry(operation, {
      maxRetries: 3,
      baseDelayMs: 500,
    });

    // First call: 500 * 2^0 = 500ms (+ jitter ~0-250ms)
    // Second call: 500 * 2^1 = 1000ms (+ jitter ~0-250ms)
    const calls = setTimeoutSpy.mock.calls;
    // At least 2 setTimeout calls for the 2 retries
    expect(calls.length).toBeGreaterThanOrEqual(2);

    // First retry delay should be ~500ms (+ jitter)
    const firstDelay = calls[0][1] as number;
    expect(firstDelay).toBeGreaterThanOrEqual(500);
    expect(firstDelay).toBeLessThan(800); // 500 + max jitter (250)

    // Second retry delay should be ~1000ms (+ jitter)
    const secondDelay = calls[1][1] as number;
    expect(secondDelay).toBeGreaterThanOrEqual(1000);
    expect(secondDelay).toBeLessThan(1300); // 1000 + max jitter (250)

    setTimeoutSpy.mockRestore();
  });
});
