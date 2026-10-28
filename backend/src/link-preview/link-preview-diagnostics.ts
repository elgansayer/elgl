import { BadRequestException } from '@nestjs/common';
import { AxiosError, isAxiosError } from 'axios';
import { TimeoutError } from 'rxjs';

/**
 * How a link-preview request ended. Used as a metric label, so it must stay a
 * small closed set.
 */
export type LinkPreviewOutcome =
  'cache_hit' | 'fetched' | 'empty' | 'rejected' | 'failed';

/**
 * Why a link preview was refused or could not be built. Values are used as
 * metric labels and log fields, so they must stay a small closed set and never
 * carry a URL, hostname or upstream message.
 */
export type LinkPreviewFailureReason =
  | 'invalid_url'
  | 'blocked_target'
  | 'timeout'
  | 'not_html'
  | 'too_large'
  | 'upstream_status'
  | 'network'
  | 'unknown';

/**
 * A refusal made by the link-preview policy itself: URL validation, the SSRF
 * guards or the content-type check. It remains a 400 for callers and carries a
 * reason that survives being wrapped by axios and follow-redirects.
 */
export class LinkPreviewFailure extends BadRequestException {
  constructor(
    message: string,
    readonly reason: LinkPreviewFailureReason,
  ) {
    super(message);
  }
}

const MAX_CAUSE_DEPTH = 5;

function causeChain(error: unknown): Error[] {
  const chain: Error[] = [];
  let current: unknown = error;
  while (current instanceof Error && chain.length < MAX_CAUSE_DEPTH) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

function classifyTransportFailure(error: AxiosError): LinkPreviewFailureReason {
  if (
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT
  ) {
    return 'timeout';
  }
  if (error.response) {
    return 'upstream_status';
  }
  if (
    error.code === AxiosError.ERR_BAD_RESPONSE &&
    error.message.includes('maxContentLength')
  ) {
    return 'too_large';
  }
  return 'network';
}

/**
 * Maps any error raised while scraping onto a {@link LinkPreviewFailureReason}.
 *
 * axios wraps errors thrown by our own `lookup` and `beforeRedirect` hooks in
 * an `AxiosError`, and the wrapper can carry the cause's `status` or
 * `response`. The policy decision is therefore read from the `cause` chain
 * before any axios heuristics, so a blocked redirect is never misreported as
 * an upstream HTTP status.
 */
export function classifyLinkPreviewFailure(
  error: unknown,
): LinkPreviewFailureReason {
  const chain = causeChain(error);

  const policy = chain.find(
    (candidate): candidate is LinkPreviewFailure =>
      candidate instanceof LinkPreviewFailure,
  );
  if (policy) {
    return policy.reason;
  }

  if (chain.some((candidate) => candidate instanceof TimeoutError)) {
    return 'timeout';
  }

  const transport = chain.find((candidate): candidate is AxiosError =>
    isAxiosError(candidate),
  );
  return transport ? classifyTransportFailure(transport) : 'unknown';
}
