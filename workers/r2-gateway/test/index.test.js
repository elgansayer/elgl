import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  createUploadSignaturePayload,
  handleRequest,
} from '../src/index.js';

const SIGNING_SECRET = 'test-signing-secret-with-at-least-32-characters';
const SERVICE_TOKEN = 'test-service-token-with-at-least-32-characters';

class FakeR2Object {
  constructor(key, bytes, options = {}) {
    this.key = key;
    this.bytes = bytes;
    this.size = bytes.byteLength;
    this.etag = createHmac('sha256', 'etag').update(bytes).digest('hex');
    this.httpEtag = `"${this.etag}"`;
    this.version = `version-${this.etag.slice(0, 12)}`;
    this.uploaded = new Date('2026-08-19T12:00:00.000Z');
    this.httpMetadata = options.httpMetadata ?? {};
    this.customMetadata = options.customMetadata ?? {};
  }

  writeHttpMetadata(headers) {
    if (this.httpMetadata.contentType) {
      headers.set('Content-Type', this.httpMetadata.contentType);
    }
    if (this.httpMetadata.cacheControl) {
      headers.set('Cache-Control', this.httpMetadata.cacheControl);
    }
  }
}

class FakeMultipartUpload {
  constructor(bucket, key, uploadId, options) {
    this.bucket = bucket;
    this.key = key;
    this.uploadId = uploadId;
    this.options = options;
    this.parts = new Map();
    this.aborted = false;
  }

  async uploadPart(partNumber, value) {
    if (this.aborted) {
      throw new Error('Upload is aborted');
    }
    const bytes = new Uint8Array(await new Response(value).arrayBuffer());
    const etag = createHmac('sha256', `part-${partNumber}`)
      .update(bytes)
      .digest('hex');
    this.parts.set(partNumber, { bytes, etag });
    return { partNumber, etag };
  }

  async complete(uploadedParts) {
    if (this.aborted) {
      throw new Error('Upload is aborted');
    }

    const chunks = uploadedParts.map(({ partNumber, etag }) => {
      const part = this.parts.get(partNumber);
      if (!part || part.etag !== etag) {
        throw new Error('Multipart ETag mismatch');
      }
      return part.bytes;
    });
    const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const object = new FakeR2Object(this.key, bytes, this.options);
    this.bucket.objects.set(this.key, object);
    this.bucket.multipart.delete(this.uploadId);
    return object;
  }

  async abort() {
    this.aborted = true;
    this.bucket.multipart.delete(this.uploadId);
  }
}

class FakeR2Bucket {
  constructor() {
    this.objects = new Map();
    this.multipart = new Map();
    this.nextUploadId = 1;
  }

  async put(key, value, options) {
    const bytes = new Uint8Array(await new Response(value).arrayBuffer());
    const object = new FakeR2Object(key, bytes, options);
    this.objects.set(key, object);
    return object;
  }

  async head(key) {
    return this.objects.get(key) ?? null;
  }

  async delete(key) {
    this.objects.delete(key);
  }

  async createMultipartUpload(key, options) {
    const uploadId = `upload-${this.nextUploadId}`;
    this.nextUploadId += 1;
    const upload = new FakeMultipartUpload(this, key, uploadId, options);
    this.multipart.set(uploadId, upload);
    return upload;
  }

  resumeMultipartUpload(key, uploadId) {
    const upload = this.multipart.get(uploadId);
    if (!upload || upload.key !== key) {
      throw new Error('Multipart upload not found');
    }
    return upload;
  }
}

function createEnvironment() {
  return {
    MEDIA_BUCKET: new FakeR2Bucket(),
    UPLOAD_SIGNING_SECRET: SIGNING_SECRET,
    SERVICE_TOKEN,
    PUBLIC_BASE_URL: 'https://media.example.com',
    ALLOWED_ORIGINS: 'https://app.example.com',
    MAX_SINGLE_UPLOAD_BYTES: '1024',
    MAX_MULTIPART_PART_BYTES: '1024',
    MAX_SIGNED_URL_LIFETIME_SECONDS: '3600',
  };
}

function signedUploadUrl({
  path,
  key,
  contentType,
  maximumBytes,
  uploadId = '',
  partNumber = '',
}) {
  const expires = Math.floor(Date.now() / 1000) + 300;
  const payload = createUploadSignaturePayload({
    method: 'PUT',
    key,
    expires,
    contentType,
    maximumBytes,
    uploadId,
    partNumber,
  });
  const signature = createHmac('sha256', SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  const url = new URL(path, 'https://gateway.example.workers.dev');
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('contentType', contentType);
  url.searchParams.set('maxBytes', String(maximumBytes));
  url.searchParams.set('signature', signature);
  return url;
}

function serviceHeaders() {
  return {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

test('writes a signed object through the R2 binding', async () => {
  const env = createEnvironment();
  const key = 'voice_notes/test-note.webm';
  const url = signedUploadUrl({
    path: `/v1/objects/${key}`,
    key,
    contentType: 'audio/webm',
    maximumBytes: 1024,
  });
  const response = await handleRequest(
    new Request(url, {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3, 4]),
      headers: {
        'Content-Type': 'audio/webm',
        Origin: 'https://app.example.com',
      },
    }),
    env,
  );

  assert.equal(response.status, 201);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://app.example.com',
  );
  const payload = await response.json();
  assert.equal(payload.key, key);
  assert.equal(payload.publicUrl, `https://media.example.com/${key}`);
  assert.deepEqual(
    Array.from(env.MEDIA_BUCKET.objects.get(key).bytes),
    [1, 2, 3, 4],
  );
});

test('rejects an invalid upload signature', async () => {
  const env = createEnvironment();
  const key = 'voice_notes/test-note.webm';
  const url = signedUploadUrl({
    path: `/v1/objects/${key}`,
    key,
    contentType: 'audio/webm',
    maximumBytes: 1024,
  });
  url.searchParams.set('signature', 'invalid');

  const response = await handleRequest(
    new Request(url, {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3, 4]),
      headers: { 'Content-Type': 'audio/webm' },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test('rejects an upload that exceeds its signed maximum', async () => {
  const env = createEnvironment();
  const key = 'voice_notes/large-note.webm';
  const url = signedUploadUrl({
    path: `/v1/objects/${key}`,
    key,
    contentType: 'audio/webm',
    maximumBytes: 3,
  });

  const response = await handleRequest(
    new Request(url, {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3, 4]),
      headers: {
        'Content-Type': 'audio/webm',
        'Content-Length': '4',
      },
    }),
    env,
  );

  assert.equal(response.status, 413);
  assert.equal(env.MEDIA_BUCKET.objects.size, 0);
});

test('requires an allowed origin for browser preflight', async () => {
  const env = createEnvironment();
  const response = await handleRequest(
    new Request('https://gateway.example.workers.dev/v1/objects/test', {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.example.com' },
    }),
    env,
  );
  assert.equal(response.status, 403);
});

test('supports a complete multipart upload without an S3 client', async () => {
  const env = createEnvironment();
  const key = 'recordings/session.webm';
  const createResponse = await handleRequest(
    new Request('https://gateway.example.workers.dev/v1/multipart', {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ key, contentType: 'video/webm' }),
    }),
    env,
  );
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();

  const uploadedParts = [];
  for (const [partNumber, body] of [
    [1, new Uint8Array([1, 2])],
    [2, new Uint8Array([3, 4])],
  ]) {
    const url = signedUploadUrl({
      path: `/v1/multipart/${created.uploadId}/parts/${partNumber}`,
      key,
      contentType: 'application/octet-stream',
      maximumBytes: 1024,
      uploadId: created.uploadId,
      partNumber: String(partNumber),
    });
    url.searchParams.set('key', key);
    const response = await handleRequest(
      new Request(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body,
      }),
      env,
    );
    assert.equal(response.status, 201);
    uploadedParts.push(await response.json());
  }

  const completeResponse = await handleRequest(
    new Request(
      `https://gateway.example.workers.dev/v1/multipart/${created.uploadId}/complete`,
      {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({ key, parts: uploadedParts }),
      },
    ),
    env,
  );
  assert.equal(completeResponse.status, 200);
  const completed = await completeResponse.json();
  assert.equal(completed.publicUrl, `https://media.example.com/${key}`);
  assert.deepEqual(
    Array.from(env.MEDIA_BUCKET.objects.get(key).bytes),
    [1, 2, 3, 4],
  );
});

test('rejects management operations without the service token', async () => {
  const env = createEnvironment();
  const response = await handleRequest(
    new Request('https://gateway.example.workers.dev/v1/multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'recordings/session.webm',
        contentType: 'video/webm',
      }),
    }),
    env,
  );
  assert.equal(response.status, 401);
});
