import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2GatewayError, R2Service, StoredObjectMetadata } from './r2.service';

const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_SINGLE_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface DownloadedR2Object {
  bytes: Uint8Array;
  contentType: string;
  etag: string;
}

@Injectable()
export class R2ObjectService {
  private readonly gatewayBaseUrl: URL;
  private readonly publicBaseUrl: string;
  private readonly serviceToken: string;
  private readonly timeoutMs: number;
  private readonly maximumBytes: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly r2Service: R2Service,
  ) {
    this.gatewayBaseUrl = this.readRequiredUrl('CLOUDFLARE_R2_GATEWAY_URL');
    this.publicBaseUrl = this.readRequiredUrl(
      'CLOUDFLARE_R2_PUBLIC_URL',
    ).toString();
    this.serviceToken = this.readRequiredSecret('CLOUDFLARE_R2_SERVICE_TOKEN');

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    if (env === 'production') {
      if (this.serviceToken === 'test-r2-service-token-with-at-least-32-characters') {
        throw new Error(
          'CLOUDFLARE_R2_SERVICE_TOKEN must be securely configured in production',
        );
      }
    }
    this.timeoutMs = this.readPositiveInteger(
      'CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS',
      DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    );
    this.maximumBytes = this.readPositiveInteger(
      'CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES',
      DEFAULT_MAX_SINGLE_UPLOAD_BYTES,
    );
  }

  createUploadUrl(
    key: string,
    contentType: string,
    maximumBytes = this.maximumBytes,
  ): { uploadUrl: string; publicUrl: string } {
    return this.r2Service.createObjectUploadUrl(key, contentType, maximumBytes);
  }

  async uploadBytes(
    key: string,
    contentType: string,
    bytes: Uint8Array,
  ): Promise<StoredObjectMetadata> {
    if (bytes.byteLength === 0 || bytes.byteLength > this.maximumBytes) {
      throw new Error('R2 object size is outside the configured limits');
    }

    const upload = this.createUploadUrl(key, contentType, bytes.byteLength);
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
      },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.readStoredObject(response);
  }

  async downloadObject(key: string): Promise<DownloadedR2Object> {
    const response = await fetch(this.objectGatewayUrl(key), {
      method: 'GET',
      headers: this.serviceHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    await this.assertSuccess(response);

    const declaredLength = response.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > this.maximumBytes) {
      throw new Error('R2 object exceeds the configured download limit');
    }

    const bytes = await readBoundedBody(response, this.maximumBytes);
    return {
      bytes,
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
      etag: response.headers.get('etag') ?? '',
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.r2Service.deleteObject(key);
  }

  publicUrlForKey(key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/${encodeObjectKey(key)}`;
  }

  private async readStoredObject(
    response: Response,
  ): Promise<StoredObjectMetadata> {
    await this.assertSuccess(response);
    const payload: unknown = await response.json();
    if (!isStoredObjectMetadata(payload)) {
      throw new R2GatewayError(
        502,
        'GATEWAY_RESPONSE_INVALID',
        'Cloudflare R2 gateway returned invalid object metadata',
      );
    }
    return payload;
  }

  private async assertSuccess(response: Response): Promise<void> {
    if (response.ok) {
      return;
    }

    let code = 'GATEWAY_REQUEST_FAILED';
    let message = `Cloudflare R2 gateway request failed with status ${response.status}`;
    try {
      const payload: unknown = await response.json();
      if (isGatewayErrorEnvelope(payload)) {
        code = payload.error.code;
        message = payload.error.message;
      }
    } catch {
      // Use the bounded status-only error when the response body is unavailable.
    }
    throw new R2GatewayError(response.status, code, message);
  }

  private objectGatewayUrl(key: string): URL {
    const path = `/v1/objects/${encodeObjectKey(key)}`;
    return new URL(
      path.replace(/^\/+/, ''),
      ensureTrailingSlash(this.gatewayBaseUrl),
    );
  }

  private serviceHeaders(): HeadersInit {
    return { Authorization: `Bearer ${this.serviceToken}` };
  }

  private readRequiredUrl(key: string): URL {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`${key} must be configured`);
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${key} must be a valid URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`${key} must use HTTP or HTTPS`);
    }
    return url;
  }

  private readRequiredSecret(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value || value.length < 32) {
      throw new Error(`${key} must contain at least 32 characters`);
    }
    return value;
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const value = this.configService.get<string | number>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    return parsed;
  }
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    totalBytes += result.value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel('R2 object exceeds configured size limit');
      throw new Error('R2 object exceeds the configured download limit');
    }
    chunks.push(result.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function encodeObjectKey(key: string): string {
  if (
    !key ||
    key.length > 1024 ||
    key.startsWith('/') ||
    key.includes('\\') ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(key) ||
    key.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('R2 object key is invalid');
  }
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function ensureTrailingSlash(url: URL): string {
  const value = url.toString();
  return value.endsWith('/') ? value : `${value}/`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredObjectMetadata(value: unknown): value is StoredObjectMetadata {
  return (
    isRecord(value) &&
    typeof value['key'] === 'string' &&
    typeof value['etag'] === 'string' &&
    typeof value['size'] === 'number' &&
    typeof value['uploadedAt'] === 'string' &&
    typeof value['publicUrl'] === 'string'
  );
}

function isGatewayErrorEnvelope(
  value: unknown,
): value is { error: { code: string; message: string } } {
  if (!isRecord(value) || !isRecord(value['error'])) {
    return false;
  }
  return (
    typeof value['error']['code'] === 'string' &&
    typeof value['error']['message'] === 'string'
  );
}
