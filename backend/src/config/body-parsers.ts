import { json, urlencoded, Request, Response } from 'express';

/** Global route prefix applied with `app.setGlobalPrefix` in main.ts. */
export const API_GLOBAL_PREFIX = 'api';

/**
 * Express path of the interface-translation endpoint. `app.use` paths are raw
 * Express paths, so they must include the global prefix.
 */
export const UI_TRANSLATION_PATH = `/${API_GLOBAL_PREFIX}/nlp/translate-ui`;

/**
 * The web client submits its whole English interface dictionary (about 110 KiB
 * of JSON today), which is above the 100 KiB default JSON limit. Requests to
 * this one route may be larger; the DTO still bounds entries, key and value
 * lengths and the total characters sent to the translation provider.
 */
export const UI_TRANSLATION_BODY_LIMIT = '512kb';

type RawBodyRequest = Request & { rawBody?: Buffer };

function captureRawBody(
  req: RawBodyRequest,
  _res: Response,
  buf: Buffer,
): void {
  req.rawBody = buf;
}

/** The subset of the Nest application the parsers need, so tests can use plain Express. */
export interface BodyParserHost {
  use(...args: unknown[]): unknown;
}

/**
 * Registers request body parsers.
 *
 * Order matters: body-parser skips a request an earlier parser already read, so
 * the route-specific limit must be mounted before the global parser. Every other
 * route keeps the default JSON limit. The raw body is preserved for signature
 * verification of payment webhooks.
 */
export function registerBodyParsers(app: BodyParserHost): void {
  app.use(UI_TRANSLATION_PATH, json({ limit: UI_TRANSLATION_BODY_LIMIT }));
  app.use(json({ verify: captureRawBody }));
  app.use(urlencoded({ extended: true, verify: captureRawBody }));
}
