import { describe, it, expect, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { withRetry, isRateLimitError } from './http-retry';

describe('http-retry', () => {
  describe('isRateLimitError', () => {
    it('returns true for HttpErrorResponse with status 429', () => {
      const error = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
      expect(isRateLimitError(error)).toBe(true);
    });

    it('returns true for object with status 429', () => {
      expect(isRateLimitError({ status: 429 })).toBe(true);
    });

    it('returns true for object with statusCode 429', () => {
      expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    });

    it('returns false for HttpErrorResponse with status 500', () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
      expect(isRateLimitError(error)).toBe(false);
    });

    it('returns false for non-object errors', () => {
      expect(isRateLimitError(null)).toBe(false);
      expect(isRateLimitError(undefined)).toBe(false);
      expect(isRateLimitError('error string')).toBe(false);
    });

    it('returns false for generic Error', () => {
      expect(isRateLimitError(new Error('something went wrong'))).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('returns result on first success without any retry', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetry(operation);
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on HTTP 429 and succeeds on second attempt', async () => {
      const rateLimitError = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
      const operation = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const result = await withRetry(operation, { baseDelayMs: 1 });
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('throws immediately on non-429 errors', async () => {
      const notFoundError = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      const operation = vi.fn().mockRejectedValue(notFoundError);

      await expect(withRetry(operation)).rejects.toEqual(notFoundError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting all retries on 429 errors', async () => {
      const rateLimitError = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
      const operation = vi.fn().mockRejectedValue(rateLimitError);

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelayMs: 1 }),
      ).rejects.toEqual(rateLimitError);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('respects custom maxRetries', async () => {
      const rateLimitError = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
      const operation = vi.fn().mockRejectedValue(rateLimitError);

      await expect(
        withRetry(operation, { maxRetries: 0, baseDelayMs: 1 }),
      ).rejects.toEqual(rateLimitError);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});