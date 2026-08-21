/**
 * Exponential backoff retry logic for HTTP 429 (Too Many Requests) responses.
 * Used by the LingQ Reading Engine (NLP service) and other external API callers.
 *
 * When an external API returns HTTP 429, this utility waits with exponential
 * backoff plus jitter before retrying, up to maxRetries attempts. If the
 * Retry-After header is present, the server-specified delay is used instead.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 60000) */
  maxDelayMs?: number;
  /** Retryable HTTP status codes beyond 429 (default: [429]) */
  retryableStatuses?: number[];
}

/**
 * Execute a fetch request with exponential backoff on HTTP 429 responses.
 *
 * Returns the raw Response object. Callers must handle body parsing (.json(),
 * .text(), .arrayBuffer()) themselves.
 *
 * The delay is calculated as: min(baseDelay * 2^attempt, maxDelay)
 * with full jitter: delay = random(0, computedDelay)
 */
export async function fetchWithExponentialBackoff(
  url: string,
  init: RequestInit,
  config: RetryConfig = {},
): Promise<Response> {
  const maxRetries = config.maxRetries ?? 3;
  const baseDelayMs = config.baseDelayMs ?? 1000;
  const maxDelayMs = config.maxDelayMs ?? 60000;
  const retryableStatuses = config.retryableStatuses ?? [429];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (!retryableStatuses.includes(response.status)) {
      return response;
    }

    // Consume body to free up the socket for connection reuse (keep-alive)
    if (typeof response.arrayBuffer === 'function') {
      await response.arrayBuffer().catch(() => {});
    }

    if (attempt < maxRetries) {
      // We are retrying. Cancel the response body so Node/undici can reuse the connection
      // in the connection pool immediately, preventing socket exhaustion.
      if (response.body) {
        await response.body.cancel().catch(() => {});
      }
      const computedDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs,
      );
      const delay = Math.random() * computedDelay;

      const retryAfter = response.headers.get('Retry-After');
      const finalDelay = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000, maxDelayMs)
        : delay;

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    } else {
      return response;
    }
  }

  throw new Error('fetchWithExponentialBackoff: unexpected state');
}
