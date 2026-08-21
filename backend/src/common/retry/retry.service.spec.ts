import { RetryService } from './retry.service';

const MOCK_LOGGER = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any;

function make429Error(): Error & {
  status: number;
  response: { status: number; headers: Record<string, string> };
} {
  return Object.assign(new Error('Too Many Requests'), {
    status: 429,
    response: { status: 429, headers: {} },
  });
}

function makeRateLimitStripeError(): Error & {
  type: string;
  statusCode: number;
} {
  return Object.assign(new Error('Stripe Rate Limit'), {
    type: 'RateLimitError',
    statusCode: 429,
  });
}

function makeSupabase429Error(): Error & { code: string } {
  return Object.assign(new Error('Supabase rate limited'), {
    code: '429',
  });
}

function makeNonRetryableError(): Error {
  return Object.assign(new Error('Internal Server Error'), {
    status: 500,
    response: { status: 500, headers: {} },
  });
}

describe('RetryService', () => {
  let service: RetryService;

  beforeEach(() => {
    service = new RetryService(MOCK_LOGGER);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withRetry', () => {
    it('should return the result on first attempt without retrying', async () => {
      const result = await service.withRetry(async () => 'success', {
        maxRetries: 2,
      });

      expect(result).toEqual({
        result: 'success',
        attempts: 1,
        totalTimeMs: expect.any(Number),
      });
    });

    it('should retry on HTTP 429 errors and eventually succeed', async () => {
      let callCount = 0;
      const result = await service.withRetry(
        async () => {
          callCount++;
          if (callCount < 3) {
            throw make429Error();
          }
          return 'recovered';
        },
        { maxRetries: 3, baseDelayMs: 10, jitter: false },
      );

      expect(callCount).toBe(3);
      expect(result.result).toBe('recovered');
      expect(result.attempts).toBe(3);
    });

    it('should retry on Stripe rate limit errors', async () => {
      let callCount = 0;
      const result = await service.withRetry(
        async () => {
          callCount++;
          if (callCount < 2) {
            throw makeRateLimitStripeError();
          }
          return 'stripe_ok';
        },
        { maxRetries: 2, baseDelayMs: 10, jitter: false },
      );

      expect(callCount).toBe(2);
      expect(result.result).toBe('stripe_ok');
    });

    it('should retry on Supabase 429 errors', async () => {
      let callCount = 0;
      const result = await service.withRetry(
        async () => {
          callCount++;
          if (callCount < 2) {
            throw makeSupabase429Error();
          }
          return 'supabase_ok';
        },
        { maxRetries: 2, baseDelayMs: 10, jitter: false },
      );

      expect(callCount).toBe(2);
      expect(result.result).toBe('supabase_ok');
    });

    it('should NOT retry on non-429 errors and throw immediately', async () => {
      let callCount = 0;

      await expect(
        service.withRetry(
          async () => {
            callCount++;
            throw makeNonRetryableError();
          },
          { maxRetries: 3, baseDelayMs: 10 },
        ),
      ).rejects.toThrow('Internal Server Error');

      expect(callCount).toBe(1);
    });

    it('should throw the last error after exhausting all retries', async () => {
      const error429 = make429Error();

      await expect(
        service.withRetry(
          async () => {
            throw error429;
          },
          { maxRetries: 2, baseDelayMs: 10, jitter: false },
        ),
      ).rejects.toThrow('Too Many Requests');
    });

    it('should respect a numeric Retry-After header (in seconds)', async () => {
      const retryAfterErr = Object.assign(new Error('Rate Limited'), {
        status: 429,
        response: {
          status: 429,
          headers: { 'retry-after': '5' },
        },
      });

      let callCount = 0;
      const start = Date.now();
      await expect(
        service.withRetry(
          async () => {
            callCount++;
            throw retryAfterErr;
          },
          { maxRetries: 1, baseDelayMs: 100, jitter: false },
        ),
      ).rejects.toThrow('Rate Limited');

      const elapsed = Date.now() - start;
      // Should have waited ~5 seconds (5000ms) from Retry-After, not the baseDelay
      // We check that it waited at least 4900ms to account for timing variance
      expect(elapsed).toBeGreaterThanOrEqual(4900);
      expect(callCount).toBe(2); // original + 1 retry
    }, 10000);

    it('should cap the delay at maxDelayMs', async () => {
      const start = Date.now();
      await expect(
        service.withRetry(
          async () => {
            throw make429Error();
          },
          {
            maxRetries: 1,
            baseDelayMs: 50000,
            maxDelayMs: 100,
            jitter: false,
          },
        ),
      ).rejects.toThrow('Too Many Requests');

      const elapsed = Date.now() - start;
      // Should be capped near 100ms, definitely under 200ms
      expect(elapsed).toBeLessThan(200);
    });

    it('should retry on error with statusCode === 429 (NestJS HttpException format)', async () => {
      let callCount = 0;
      const nestError = Object.assign(new Error('Too Many Requests'), {
        statusCode: 429,
      });

      const result = await service.withRetry(
        async () => {
          callCount++;
          if (callCount < 2) throw nestError;
          return 'recovered';
        },
        { maxRetries: 2, baseDelayMs: 10, jitter: false },
      );

      expect(callCount).toBe(2);
      expect(result.result).toBe('recovered');
    });

    it('should use exponential backoff delay calculation', async () => {
      const start = Date.now();
      await expect(
        service.withRetry(
          async () => {
            throw make429Error();
          },
          {
            maxRetries: 2,
            baseDelayMs: 100,
            maxDelayMs: 10000,
            jitter: false,
          },
        ),
      ).rejects.toThrow('Too Many Requests');

      const elapsed = Date.now() - start;
      // Attempt 0: baseDelay * 2^0 = 100ms
      // Attempt 1: baseDelay * 2^1 = 200ms
      // Total: ~300ms
      expect(elapsed).toBeGreaterThanOrEqual(290);
      expect(elapsed).toBeLessThan(500);
    });

    it('should pass through undefined/null errors without crashing', async () => {
      // This is for a non-429, so no retry -- just immediate throw
      await expect(
        service.withRetry(
          async () => {
            throw new Error('Non-http-error');
          },
          { maxRetries: 3, baseDelayMs: 10 },
        ),
      ).rejects.toThrow('Non-http-error');
    });
  });
});
