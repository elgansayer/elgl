import type { Mocked } from 'vitest';
import { Logger } from '@nestjs/common';
import { withExponentialBackoff } from './http-retry.helper';

function createHttp429Error(
  message = 'Too Many Requests',
): Record<string, unknown> {
  const error = new Error(message) as Record<string, unknown>;
  error.response = { status: 429, data: { message } };
  error.status = 429;
  return error;
}

describe('withExponentialBackoff', () => {
  let mockLogger: Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Mocked<Logger>;
  });

  it('should return the result on first success without retries', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withExponentialBackoff(operation, 'test-op', {
      logger: mockLogger,
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should retry on HTTP 429 and succeed on the second attempt', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(createHttp429Error())
      .mockResolvedValueOnce('recovered');

    const result = withExponentialBackoff(operation, 'test-op', {
      maxRetries: 3,
      baseDelayMs: 0,
      logger: mockLogger,
    });

    await expect(result).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 429'),
    );
  });

  it('should use exponential backoff delay between retries', async () => {
    const httpError = createHttp429Error();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(httpError)
      .mockRejectedValueOnce(httpError)
      .mockResolvedValueOnce('ok');

    const result = withExponentialBackoff(operation, 'test-op', {
      maxRetries: 5,
      baseDelayMs: 0,
      logger: mockLogger,
    });

    await expect(result).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(mockLogger.debug).toHaveBeenCalledTimes(2);
  });

  it('should throw a non-429 error immediately without retry', async () => {
    const networkError = new Error('Network failure');
    const operation = vi.fn().mockRejectedValue(networkError);

    await expect(
      withExponentialBackoff(operation, 'test-op', { logger: mockLogger }),
    ).rejects.toThrow('Network failure');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('should exhaust retries and throw the last 429 error', async () => {
    const httpError = createHttp429Error();
    const operation = vi.fn().mockRejectedValue(httpError);

    const result = withExponentialBackoff(operation, 'test-op', {
      maxRetries: 2,
      baseDelayMs: 0,
      logger: mockLogger,
    });

    await expect(result).rejects.toBe(httpError);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exhausted'),
    );
  });

  it('should throw when retries are exhausted even without configured maxRetries', async () => {
    const httpError = createHttp429Error();
    const operation = vi.fn().mockRejectedValue(httpError);

    const result = withExponentialBackoff(operation, 'test-op', {
      maxRetries: 0,
      baseDelayMs: 0,
      logger: mockLogger,
    });

    await expect(result).rejects.toBe(httpError);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exhausted'),
    );
  });
});
