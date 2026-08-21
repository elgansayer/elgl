const API_PREFIX = '/v1';
const OBJECT_PREFIX = `${API_PREFIX}/objects/`;
const MULTIPART_PREFIX = `${API_PREFIX}/multipart`;
const DEFAULT_MAX_SINGLE_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_MULTIPART_PART_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_SIGNED_URL_LIFETIME_SECONDS = 24 * 60 * 60;
const MAX_KEY_LENGTH = 1024;
const MAX_JSON_BODY_BYTES = 64 * 1024;
const encoder = new TextEncoder();

class GatewayError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.code = code;
  }
}

class UploadLimitError extends Error {
  constructor() {
    super('Upload exceeds the permitted size');
    this.name = 'UploadLimitError';
  }
}

export default {
  fetch: handleRequest,
};

export async function handleRequest(request, env) {
  try {
    assertEnvironment(env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(
        {
          status: 'ok',
          storage: 'cloudflare-r2-binding',
          version: 1,
        },
        200,
      );
    }

    if (url.pathname.startsWith(OBJECT_PREFIX)) {
      const key = decodeObjectKey(url.pathname.slice(OBJECT_PREFIX.length));
      validateObjectKey(key);

      if (request.method === 'PUT') {
        return withCors(
          await putObject(request, env, url, key),
          request,
          env,
        );
      }

      if (request.method === 'HEAD') {
        await requireServiceAuthentication(request, env);
        return headObject(env, key);
      }

      if (request.method === 'DELETE') {
        await requireServiceAuthentication(request, env);
        await env.MEDIA_BUCKET.delete(key);
        return new Response(null, { status: 204 });
      }

      return methodNotAllowed(['PUT', 'HEAD', 'DELETE', 'OPTIONS']);
    }

    if (request.method === 'POST' && url.pathname === MULTIPART_PREFIX) {
      await requireServiceAuthentication(request, env);
      return createMultipartUpload(request, env);
    }

    const partMatch = url.pathname.match(
      /^\/v1\/multipart\/([^/]+)\/parts\/([1-9][0-9]*)$/,
    );
    if (partMatch) {
      if (request.method !== 'PUT') {
        return methodNotAllowed(['PUT', 'OPTIONS']);
      }

      const uploadId = decodeURIComponent(partMatch[1]);
      const partNumber = parsePositiveInteger(partMatch[2], 'partNumber');
      return withCors(
        await uploadMultipartPart(
          request,
          env,
          url,
          uploadId,
          partNumber,
        ),
        request,
        env,
      );
    }

    const completeMatch = url.pathname.match(
      /^\/v1\/multipart\/([^/]+)\/complete$/,
    );
    if (completeMatch) {
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }

      await requireServiceAuthentication(request, env);
      return completeMultipartUpload(
        request,
        env,
        decodeURIComponent(completeMatch[1]),
      );
    }

    const multipartMatch = url.pathname.match(/^\/v1\/multipart\/([^/]+)$/);
    if (multipartMatch) {
      if (request.method !== 'DELETE') {
        return methodNotAllowed(['DELETE']);
      }

      await requireServiceAuthentication(request, env);
      return abortMultipartUpload(
        env,
        url,
        decodeURIComponent(multipartMatch[1]),
      );
    }

    return errorResponse(404, 'NOT_FOUND', 'Route not found');
  } catch (error) {
    if (error instanceof GatewayError) {
      return errorResponse(error.status, error.code, error.message);
    }

    if (error instanceof UploadLimitError) {
      return errorResponse(
        413,
        'UPLOAD_TOO_LARGE',
        'Upload exceeds the permitted size',
      );
    }

    console.error('Cloudflare R2 gateway request failed', normaliseError(error));
    return errorResponse(500, 'INTERNAL_ERROR', 'Storage request failed');
  }
}

async function putObject(request, env, url, key) {
  const signed = await validateSignedUploadRequest({
    request,
    env,
    url,
    key,
    uploadId: '',
    partNumber: '',
    configuredMaximum: configuredNumber(
      env.MAX_SINGLE_UPLOAD_BYTES,
      DEFAULT_MAX_SINGLE_UPLOAD_BYTES,
    ),
  });

  if (!request.body) {
    throw new GatewayError(400, 'BODY_REQUIRED', 'Upload body is required');
  }

  const body = boundedBody(request.body, signed.maximumBytes);
  const object = await env.MEDIA_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: signed.contentType,
      cacheControl: cacheControlForKey(key),
    },
    customMetadata: {
      uploadProtocol: 'cloudflare-worker-v1',
    },
  });

  if (!object) {
    throw new GatewayError(500, 'R2_WRITE_FAILED', 'R2 did not return object metadata');
  }

  return jsonResponse(
    {
      key: object.key,
      etag: object.etag,
      size: object.size,
      uploadedAt: object.uploaded.toISOString(),
      publicUrl: publicUrlForKey(env, key),
    },
    201,
    {
      ETag: object.httpEtag,
    },
  );
}

async function headObject(env, key) {
  const object = await env.MEDIA_BUCKET.head(key);
  if (!object) {
    return errorResponse(404, 'OBJECT_NOT_FOUND', 'Object not found');
  }

  const headers = new Headers({
    ETag: object.httpEtag,
    'Content-Length': String(object.size),
    'X-R2-Key': object.key,
    'X-R2-Version': object.version,
    'X-R2-Uploaded-At': object.uploaded.toISOString(),
  });
  object.writeHttpMetadata(headers);
  return new Response(null, { status: 200, headers });
}

async function createMultipartUpload(request, env) {
  const body = await readJsonObject(request);
  const key = requiredString(body, 'key');
  const contentType = normaliseContentType(requiredString(body, 'contentType'));
  validateObjectKey(key);
  validateContentType(contentType);

  const upload = await env.MEDIA_BUCKET.createMultipartUpload(key, {
    httpMetadata: {
      contentType,
      cacheControl: cacheControlForKey(key),
    },
    customMetadata: {
      uploadProtocol: 'cloudflare-worker-multipart-v1',
    },
  });

  return jsonResponse(
    {
      key: upload.key,
      uploadId: upload.uploadId,
    },
    201,
  );
}

async function uploadMultipartPart(
  request,
  env,
  url,
  uploadId,
  partNumber,
) {
  if (!uploadId) {
    throw new GatewayError(400, 'UPLOAD_ID_REQUIRED', 'Upload ID is required');
  }

  const key = url.searchParams.get('key') ?? '';
  validateObjectKey(key);

  const signed = await validateSignedUploadRequest({
    request,
    env,
    url,
    key,
    uploadId,
    partNumber: String(partNumber),
    configuredMaximum: configuredNumber(
      env.MAX_MULTIPART_PART_BYTES,
      DEFAULT_MAX_MULTIPART_PART_BYTES,
    ),
  });

  if (!request.body) {
    throw new GatewayError(400, 'BODY_REQUIRED', 'Upload body is required');
  }

  const upload = env.MEDIA_BUCKET.resumeMultipartUpload(key, uploadId);
  const part = await upload.uploadPart(
    partNumber,
    boundedBody(request.body, signed.maximumBytes),
  );

  return jsonResponse(
    {
      partNumber: part.partNumber,
      etag: part.etag,
    },
    201,
    {
      ETag: quoteEtag(part.etag),
    },
  );
}

async function completeMultipartUpload(request, env, uploadId) {
  if (!uploadId) {
    throw new GatewayError(400, 'UPLOAD_ID_REQUIRED', 'Upload ID is required');
  }

  const body = await readJsonObject(request);
  const key = requiredString(body, 'key');
  validateObjectKey(key);
  const parts = readUploadedParts(body.parts);
  const upload = env.MEDIA_BUCKET.resumeMultipartUpload(key, uploadId);
  const object = await upload.complete(parts);

  return jsonResponse(
    {
      key: object.key,
      etag: object.etag,
      size: object.size,
      uploadedAt: object.uploaded.toISOString(),
      publicUrl: publicUrlForKey(env, key),
    },
    200,
    {
      ETag: object.httpEtag,
    },
  );
}

async function abortMultipartUpload(env, url, uploadId) {
  if (!uploadId) {
    throw new GatewayError(400, 'UPLOAD_ID_REQUIRED', 'Upload ID is required');
  }

  const key = url.searchParams.get('key') ?? '';
  validateObjectKey(key);
  const upload = env.MEDIA_BUCKET.resumeMultipartUpload(key, uploadId);
  await upload.abort();
  return new Response(null, { status: 204 });
}

async function validateSignedUploadRequest({
  request,
  env,
  url,
  key,
  uploadId,
  partNumber,
  configuredMaximum,
}) {
  const expires = parsePositiveInteger(
    url.searchParams.get('expires'),
    'expires',
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxLifetime = configuredNumber(
    env.MAX_SIGNED_URL_LIFETIME_SECONDS,
    DEFAULT_MAX_SIGNED_URL_LIFETIME_SECONDS,
  );

  if (expires < nowSeconds) {
    throw new GatewayError(403, 'UPLOAD_URL_EXPIRED', 'Upload URL has expired');
  }

  if (expires - nowSeconds > maxLifetime) {
    throw new GatewayError(
      403,
      'UPLOAD_URL_LIFETIME_INVALID',
      'Upload URL lifetime exceeds the configured maximum',
    );
  }

  const contentType = normaliseContentType(
    url.searchParams.get('contentType') ?? '',
  );
  validateContentType(contentType);
  const requestContentType = normaliseContentType(
    request.headers.get('content-type') ?? '',
  );

  if (requestContentType !== contentType) {
    throw new GatewayError(
      400,
      'CONTENT_TYPE_MISMATCH',
      'Request content type does not match the signed content type',
    );
  }

  const maximumBytes = parsePositiveInteger(
    url.searchParams.get('maxBytes'),
    'maxBytes',
  );
  if (maximumBytes > configuredMaximum) {
    throw new GatewayError(
      403,
      'UPLOAD_LIMIT_INVALID',
      'Signed upload limit exceeds the configured maximum',
    );
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = parsePositiveInteger(contentLength, 'content-length');
    if (parsedLength > maximumBytes) {
      throw new GatewayError(
        413,
        'UPLOAD_TOO_LARGE',
        'Upload exceeds the permitted size',
      );
    }
  }

  const signature = url.searchParams.get('signature') ?? '';
  if (!signature) {
    throw new GatewayError(403, 'SIGNATURE_REQUIRED', 'Upload signature is required');
  }

  const canonical = createUploadSignaturePayload({
    method: request.method,
    key,
    expires,
    contentType,
    maximumBytes,
    uploadId,
    partNumber,
  });

  const valid = await verifyHmac(
    env.UPLOAD_SIGNING_SECRET,
    canonical,
    signature,
  );
  if (!valid) {
    throw new GatewayError(403, 'SIGNATURE_INVALID', 'Upload signature is invalid');
  }

  return { contentType, maximumBytes };
}

export function createUploadSignaturePayload({
  method,
  key,
  expires,
  contentType,
  maximumBytes,
  uploadId = '',
  partNumber = '',
}) {
  return [
    'cloudflare-r2-upload-v1',
    method.toUpperCase(),
    key,
    String(expires),
    normaliseContentType(contentType),
    String(maximumBytes),
    uploadId,
    String(partNumber),
  ].join('\n');
}

async function verifyHmac(secret, payload, encodedSignature) {
  if (!secret) {
    throw new GatewayError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      'Upload signing secret is not configured',
    );
  }

  let signature;
  try {
    signature = decodeBase64Url(encodedSignature);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload));
}

async function requireServiceAuthentication(request, env) {
  if (!env.SERVICE_TOKEN) {
    throw new GatewayError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      'Service token is not configured',
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.SERVICE_TOKEN}`;
  if (!(await secureEqual(authorization, expected))) {
    throw new GatewayError(401, 'UNAUTHORISED', 'Service authentication failed');
  }
}

async function secureEqual(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^
      (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function boundedBody(body, maximumBytes) {
  let totalBytes = 0;
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        totalBytes += chunkByteLength(chunk);
        if (totalBytes > maximumBytes) {
          controller.error(new UploadLimitError());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

function chunkByteLength(chunk) {
  if (typeof chunk === 'string') {
    return encoder.encode(chunk).byteLength;
  }
  if (chunk instanceof ArrayBuffer) {
    return chunk.byteLength;
  }
  if (ArrayBuffer.isView(chunk)) {
    return chunk.byteLength;
  }
  throw new GatewayError(
    400,
    'UPLOAD_CHUNK_INVALID',
    'Upload stream contained an unsupported chunk type',
  );
}

async function readJsonObject(request) {
  const contentLength = request.headers.get('content-length');
  if (
    contentLength &&
    parsePositiveInteger(contentLength, 'content-length') > MAX_JSON_BODY_BYTES
  ) {
    throw new GatewayError(413, 'JSON_TOO_LARGE', 'JSON body is too large');
  }

  const text = await request.text();
  if (encoder.encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new GatewayError(413, 'JSON_TOO_LARGE', 'JSON body is too large');
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GatewayError(400, 'JSON_INVALID', 'Request body must be valid JSON');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GatewayError(400, 'JSON_INVALID', 'Request body must be a JSON object');
  }
  return value;
}

function readUploadedParts(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10000) {
    throw new GatewayError(
      400,
      'PARTS_INVALID',
      'Parts must be a non-empty array with at most 10000 entries',
    );
  }

  const seen = new Set();
  const parts = value.map((part) => {
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      throw new GatewayError(400, 'PART_INVALID', 'Each part must be an object');
    }

    const partNumber = parsePositiveInteger(part.partNumber, 'partNumber');
    if (partNumber > 10000 || seen.has(partNumber)) {
      throw new GatewayError(
        400,
        'PART_NUMBER_INVALID',
        'Part numbers must be unique and between 1 and 10000',
      );
    }
    seen.add(partNumber);

    const etag = requiredString(part, 'etag');
    return { partNumber, etag };
  });

  return parts.sort((left, right) => left.partNumber - right.partNumber);
}

function requiredString(record, field) {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new GatewayError(
      400,
      'FIELD_REQUIRED',
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

function parsePositiveInteger(value, field) {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new GatewayError(
      400,
      'NUMBER_INVALID',
      `${field} must be a positive integer`,
    );
  }
  return parsed;
}

function configuredNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return parsePositiveInteger(value, 'configuration value');
}

function normaliseContentType(value) {
  return value.split(';', 1)[0].trim().toLowerCase();
}

function validateContentType(value) {
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(value)) {
    throw new GatewayError(400, 'CONTENT_TYPE_INVALID', 'Content type is invalid');
  }
}

function decodeObjectKey(encodedPath) {
  try {
    return encodedPath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    throw new GatewayError(400, 'KEY_INVALID', 'Object key is invalid');
  }
}

function validateObjectKey(key) {
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new GatewayError(400, 'KEY_INVALID', 'Object key length is invalid');
  }
  if (key.startsWith('/') || key.includes('\\') || /[\u0000-\u001f\u007f]/.test(key)) {
    throw new GatewayError(400, 'KEY_INVALID', 'Object key contains invalid characters');
  }
  if (key.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new GatewayError(400, 'KEY_INVALID', 'Object key contains invalid path segments');
  }
}

function cacheControlForKey(key) {
  return key.startsWith('private/')
    ? 'private, no-store'
    : 'public, max-age=31536000, immutable';
}

function publicUrlForKey(env, key) {
  const base = String(env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${encodedKey}`;
}

function decodeBase64Url(value) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalised.length % 4)) % 4;
  const decoded = atob(`${normalised}${'='.repeat(paddingLength)}`);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function quoteEtag(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value;
  }
  return `"${value}"`;
}

function handlePreflight(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !originAllowed(origin, env.ALLOWED_ORIGINS)) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed');
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

function withCors(response, request, env) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return response;
  }
  if (!originAllowed(origin, env.ALLOWED_ORIGINS)) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed');
  }

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'ETag');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function originAllowed(origin, configuredOrigins) {
  const allowed = String(configuredOrigins ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes('*') || allowed.includes(origin);
}

function methodNotAllowed(methods) {
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', {
    Allow: methods.join(', '),
  });
}

function jsonResponse(value, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(value), { status, headers });
}

function errorResponse(status, code, message, extraHeaders = {}) {
  return jsonResponse({ error: { code, message } }, status, extraHeaders);
}

function assertEnvironment(env) {
  if (!env || !env.MEDIA_BUCKET) {
    throw new GatewayError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      'Cloudflare R2 bucket binding is not configured',
    );
  }
  if (!env.PUBLIC_BASE_URL) {
    throw new GatewayError(
      503,
      'GATEWAY_NOT_CONFIGURED',
      'Public media base URL is not configured',
    );
  }
}

function normaliseError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'UnknownError', message: String(error) };
}
