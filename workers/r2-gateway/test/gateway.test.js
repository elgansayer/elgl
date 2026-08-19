import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/gateway.js';

const SERVICE_TOKEN = 'test-service-token-with-at-least-32-characters';

function createObject(key, body, contentType) {
  const bytes = new TextEncoder().encode(body);
  return {
    key,
    body: new Response(bytes).body,
    size: bytes.byteLength,
    etag: 'etag-value',
    httpEtag: '"etag-value"',
    version: 'version-1',
    uploaded: new Date('2026-08-19T12:00:00.000Z'),
    writeHttpMetadata(headers) {
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'public, max-age=31536000');
    },
  };
}

test('returns a stored object to an authenticated backend service', async () => {
  const key = 'covers/user-1/photo.webp';
  const object = createObject(key, 'image-bytes', 'image/webp');
  const env = {
    SERVICE_TOKEN,
    PUBLIC_BASE_URL: 'https://media.example.com',
    MEDIA_BUCKET: {
      get: async (requestedKey) =>
        requestedKey === key ? object : null,
    },
  };

  const response = await worker.fetch(
    new Request(
      `https://gateway.example.workers.dev/v1/objects/${key}`,
      {
        headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
      },
    ),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-r2-key'), key);
  assert.equal(await response.text(), 'image-bytes');
});

test('does not expose stored objects without service authentication', async () => {
  const env = {
    SERVICE_TOKEN,
    PUBLIC_BASE_URL: 'https://media.example.com',
    MEDIA_BUCKET: {
      get: async () => createObject('private/object', 'secret', 'text/plain'),
    },
  };

  const response = await worker.fetch(
    new Request(
      'https://gateway.example.workers.dev/v1/objects/private/object',
    ),
    env,
  );

  assert.equal(response.status, 401);
});
