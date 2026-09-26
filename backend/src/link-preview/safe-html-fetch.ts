import { HttpService } from '@nestjs/axios';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';
import { isPrivateIp } from './ip-guard';
import {
  assertPublicRedirectTarget,
  parseLinkPreviewUrl,
} from './link-preview-url';

/**
 * At most this many bytes of a page are read. OpenGraph tags live in the
 * document head, so the rest is ignored instead of being buffered and parsed.
 */
export const MAX_HTML_BYTES = 1_048_576;
/** Socket inactivity limit for one request. */
export const REQUEST_IDLE_TIMEOUT_MS = 5_000;
/** Wall-clock limit for a whole scrape, including every redirect and the body. */
export const FETCH_DEADLINE_MS = 8_000;
export const MAX_REDIRECTS = 3;
export const LINK_PREVIEW_USER_AGENT = 'ELGL-LinkPreview/1.0';

/** Raised by the guarded DNS lookup when a hostname resolves to a non-public address. */
export class BlockedAddressError extends Error {
  constructor() {
    super('SSRF blocked: resolved address is not publicly routable');
    this.name = 'BlockedAddressError';
  }
}

/** Raised when the origin answers with something other than an HTML document. */
export class NotHtmlResponseError extends Error {
  constructor() {
    super('URL does not point to an HTML resource');
    this.name = 'NotHtmlResponseError';
  }
}

/**
 * DNS lookup that refuses non-public addresses. It runs for every connection
 * the agents open, so it validates the address that is actually dialled and
 * leaves no window for DNS rebinding between a check and the request.
 */
export function guardedLookup(
  hostname: string,
  options: dns.LookupOptions | number,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family: number,
  ) => void,
): void {
  const lookupOptions: dns.LookupOptions =
    typeof options === 'number' ? { family: options } : options;

  dns.lookup(hostname, lookupOptions, (err, address, family) => {
    if (err) {
      callback(err, address, family);
      return;
    }

    const candidates =
      typeof address === 'string'
        ? [address]
        : address.map((candidate) => candidate.address);
    if (candidates.some((candidate) => isPrivateIp(candidate))) {
      callback(new BlockedAddressError(), address, family);
      return;
    }
    callback(null, address, family);
  });
}

export type GuardedLookup = typeof guardedLookup;

export interface GuardedAgents {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
}

export function createGuardedAgents(
  lookup: GuardedLookup = guardedLookup,
): GuardedAgents {
  return {
    httpAgent: new http.Agent({ lookup }),
    httpsAgent: new https.Agent({ lookup }),
  };
}

const defaultAgents = createGuardedAgents();

export interface FetchHtmlOptions {
  /** Overrides the wall-clock limit for the whole scrape. */
  deadlineMs?: number;
  /** Overrides the agents; tests use this to control name resolution. */
  agents?: GuardedAgents;
}

export interface FetchedHtml {
  /** The page as bytes so the charset can be sniffed; a string only when a caller pre-decoded it. */
  body: Buffer | string;
  contentType: string;
  /** The address the content came from after redirects, for resolving relative URLs. */
  finalUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function headerText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

function isHtmlContentType(contentType: string): boolean {
  const mimeType = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  return mimeType === 'text/html' || mimeType === 'application/xhtml+xml';
}

function discardBody(data: unknown): void {
  if (data instanceof Readable) {
    data.destroy();
  }
}

/**
 * Reads at most `maxBytes` of the response body and then abandons the rest.
 * Axios yields a stream for `responseType: 'stream'`; strings and buffers are
 * accepted so an adapter that already buffered the body behaves the same way.
 */
async function readBoundedBody(
  data: unknown,
  maxBytes: number,
): Promise<Buffer | string> {
  if (typeof data === 'string') {
    return data.length > maxBytes ? data.slice(0, maxBytes) : data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.subarray(0, maxBytes));
  }
  if (!(data instanceof Readable)) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of data) {
    const value: unknown = chunk;
    const bytes =
      typeof value === 'string'
        ? Buffer.from(value)
        : value instanceof Uint8Array
          ? Buffer.from(value)
          : null;
    if (!bytes) {
      continue;
    }
    total += bytes.length;
    if (total >= maxBytes) {
      chunks.push(bytes.subarray(0, bytes.length - (total - maxBytes)));
      break;
    }
    chunks.push(bytes);
  }
  // Breaking out of the loop already destroys the stream; this also covers a
  // stream that ended cleanly so the socket is never left open.
  data.destroy();
  return Buffer.concat(chunks);
}

/** The address the response finally came from, or the requested one when unknown. */
function finalUrlOf(
  response: { request?: unknown },
  requested: string,
): string {
  const request: unknown = response.request;
  if (isRecord(request)) {
    const res = request['res'];
    if (isRecord(res) && typeof res['responseUrl'] === 'string') {
      try {
        return parseLinkPreviewUrl(res['responseUrl']).href;
      } catch {
        // An unexpected value must not replace the address that was validated.
      }
    }
  }
  return requested;
}

/**
 * Downloads an HTML page for metadata extraction without trusting the origin.
 *
 * - Every connection resolves through {@link guardedLookup}, and every redirect
 *   target is validated with the URL policy before it is requested, so a public
 *   page cannot bounce the scraper onto a private address.
 * - The whole scrape (redirects and body included) is limited by a wall-clock
 *   deadline, so an origin that trickles bytes cannot hold a connection open.
 * - Only the first {@link MAX_HTML_BYTES} of the body are read.
 * - Environment proxies are disabled so name resolution always happens in the
 *   guarded agents instead of at a proxy the guard cannot see.
 *
 * The starting `url` must already satisfy `parseLinkPreviewUrl`; only the
 * redirects that follow are re-checked here.
 */
export async function fetchHtml(
  httpService: HttpService,
  url: string,
  options: FetchHtmlOptions = {},
): Promise<FetchedHtml> {
  const agents = options.agents ?? defaultAgents;

  const response = await firstValueFrom(
    httpService.get<unknown>(url, {
      responseType: 'stream',
      timeout: REQUEST_IDLE_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      httpAgent: agents.httpAgent,
      httpsAgent: agents.httpsAgent,
      proxy: false,
      signal: AbortSignal.timeout(options.deadlineMs ?? FETCH_DEADLINE_MS),
      beforeRedirect: (redirectOptions) =>
        assertPublicRedirectTarget(redirectOptions['href']),
      headers: {
        'User-Agent': LINK_PREVIEW_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
    }),
  );

  const contentType = headerText(response.headers['content-type']);
  if (!isHtmlContentType(contentType)) {
    discardBody(response.data);
    throw new NotHtmlResponseError();
  }

  return {
    body: await readBoundedBody(response.data, MAX_HTML_BYTES),
    contentType,
    finalUrl: finalUrlOf(response, url),
  };
}
