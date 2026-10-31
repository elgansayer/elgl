import express from 'express';
import request from 'supertest';
import {
  API_GLOBAL_PREFIX,
  UI_TRANSLATION_BODY_LIMIT,
  UI_TRANSLATION_PATH,
  registerBodyParsers,
} from './body-parsers';

interface EchoBody {
  entries: number;
  rawBodyBytes: number | null;
}

function buildApp(): express.Express {
  const app = express();
  registerBodyParsers({
    use: (...args: unknown[]) =>
      (app.use as (...parameters: unknown[]) => unknown)(...args),
  });
  const echo: express.RequestHandler = (req, res) => {
    const body = req.body as { dictionary?: Record<string, string> };
    const raw = (req as express.Request & { rawBody?: Buffer }).rawBody;
    const payload: EchoBody = {
      entries: Object.keys(body.dictionary ?? {}).length,
      rawBodyBytes: raw ? raw.length : null,
    };
    res.status(201).json(payload);
  };
  app.post(UI_TRANSLATION_PATH, echo);
  app.post(`/${API_GLOBAL_PREFIX}/other`, echo);
  app.use(
    (
      error: { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(error.status ?? 500).json({ error: error.type });
    },
  );
  return app;
}

/** A dictionary body of roughly the requested size, shaped like the real client request. */
function dictionaryBody(targetBytes: number): {
  target_language: string;
  dictionary: Record<string, string>;
} {
  const dictionary: Record<string, string> = {};
  let size = 0;
  for (let index = 0; size < targetBytes; index += 1) {
    const key = `section.group.key${String(index).padStart(5, '0')}`;
    const value = 'Translatable interface text sample.';
    dictionary[key] = value;
    size += key.length + value.length + 6;
  }
  return { target_language: 'es', dictionary };
}

describe('registerBodyParsers', () => {
  const realClientRequestBytes = 112 * 1024;

  it('names the interface-translation route with the global API prefix', () => {
    expect(UI_TRANSLATION_PATH).toBe('/api/nlp/translate-ui');
  });

  it('accepts a real-sized interface dictionary on the translation route', async () => {
    const body = dictionaryBody(realClientRequestBytes);
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(100 * 1024);

    const response = await request(buildApp())
      .post(UI_TRANSLATION_PATH)
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body.entries).toBe(Object.keys(body.dictionary).length);
  });

  it('keeps the default 100 KiB limit on every other route', async () => {
    const response = await request(buildApp())
      .post(`/${API_GLOBAL_PREFIX}/other`)
      .send(dictionaryBody(realClientRequestBytes));

    expect(response.status).toBe(413);
    expect(response.body.error).toBe('entity.too.large');
  });

  it('still rejects oversized bodies on the translation route', async () => {
    expect(UI_TRANSLATION_BODY_LIMIT).toBe('512kb');

    const response = await request(buildApp())
      .post(UI_TRANSLATION_PATH)
      .send(dictionaryBody(520 * 1024));

    expect(response.status).toBe(413);
  });

  it('preserves the raw body for routes that verify webhook signatures', async () => {
    const payload = JSON.stringify({ dictionary: { a: 'b' } });

    const response = await request(buildApp())
      .post(`/${API_GLOBAL_PREFIX}/other`)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.rawBodyBytes).toBe(Buffer.byteLength(payload));
  });
});
