import worker, { handleRequest } from './index.js';

const OBJECT_PREFIX = '/v1/objects/';
const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.pathname.startsWith(OBJECT_PREFIX)) {
      return worker.fetch(request, env);
    }

    if (!env?.MEDIA_BUCKET || !env.SERVICE_TOKEN) {
      return errorResponse(
        503,
        'GATEWAY_NOT_CONFIGURED',
        'Cloudflare R2 gateway is not configured',
      );
    }

    const authorised = await serviceAuthorised(request, env.SERVICE_TOKEN);
    if (!authorised) {
      return errorResponse(401, 'UNAUTHORISED', 'Service authentication failed');
    }

    let key;
    try {
      key = decodeObjectKey(url.pathname.slice(OBJECT_PREFIX.length));
      validateObjectKey(key);
    } catch {
      return errorResponse(400, 'KEY_INVALID', 'Object key is invalid');
    }

    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) {
      return errorResponse(404, 'OBJECT_NOT_FOUND', 'Object not found');
    }

    const headers = new Headers({
      ETag: object.httpEtag,
      'Content-Length': String(object.size),
      'X-R2-Key': object.key,
      'X-R2-Version': object.version,
      'X-R2-Uploaded-At': object.uploaded.toISOString(),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'private, no-store');
    return new Response(object.body, { status: 200, headers });
  },
};

export { handleRequest };

async function serviceAuthorised(request, serviceToken) {
  const supplied = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${serviceToken}`;
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = suppliedBytes.length ^ expectedBytes.length;
  const length = Math.max(suppliedBytes.length, expectedBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (suppliedBytes[index] ?? 0) ^
      (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

function decodeObjectKey(encodedPath) {
  return encodedPath
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

function validateObjectKey(key) {
  if (
    !key ||
    key.length > 1024 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(key) ||
    key.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid object key');
  }
}

function errorResponse(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
