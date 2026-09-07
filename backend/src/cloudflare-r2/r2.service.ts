import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';

const DEFAULT_UPLOAD_TTL_SECONDS = 3600;
const DEFAULT_MAX_SINGLE_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_MULTIPART_PART_BYTES = 100 * 1024 * 1024;
const DEFAULT_SOURCE_FETCH_TIMEOUT_MS = 30_000;
const MAX_SOURCE_REDIRECTS = 3;
const MAX_KEY_LENGTH = 1024;

export interface MultipartUploadHandle {
  key: string;
  uploadId: string;
}

export interface MultipartUploadedPart {
  partNumber: number;
  etag: string;
}

export interface StoredObjectMetadata {
  key: string;
  etag: string;
  size: number;
  uploadedAt: string;
  publicUrl: string;
}

interface SignedUploadParameters {
  key: string;
  contentType: string;
  maximumBytes: number;
  uploadId?: string;
  partNumber?: number;
}

interface SourceDownload {
  bytes: Uint8Array;
  contentType: string;
}

export class R2GatewayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'R2GatewayError';
  }
}

@Injectable()
export class R2Service {
  private readonly gatewayBaseUrl: URL;
  private readonly publicBaseUrl: string;
  private readonly signingSecret: string;
  private readonly serviceToken: string;
  private readonly uploadTtlSeconds: number;
  private readonly maxSingleUploadBytes: number;
  private readonly maxMultipartPartBytes: number;
  private readonly sourceFetchTimeoutMs: number;
  private readonly sourceHosts: string[];

  constructor(private readonly configService: ConfigService) {
    this.gatewayBaseUrl = this.readRequiredUrl('CLOUDFLARE_R2_GATEWAY_URL');
    this.publicBaseUrl = this.readRequiredUrl(
      'CLOUDFLARE_R2_PUBLIC_URL',
    ).toString();
    this.signingSecret = this.readRequiredSecret(
      'CLOUDFLARE_R2_SIGNING_SECRET',
    );
    this.serviceToken = this.readRequiredSecret('CLOUDFLARE_R2_SERVICE_TOKEN');

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    if (env === 'production') {
      if (
        this.signingSecret === 'test-r2-signing-secret-with-at-least-32-characters' ||
        this.serviceToken === 'test-r2-service-token-with-at-least-32-characters'
      ) {
        throw new Error(
          'CLOUDFLARE_R2_SIGNING_SECRET and CLOUDFLARE_R2_SERVICE_TOKEN must be securely configured in production',
        );
      }
    }
    this.uploadTtlSeconds = this.readPositiveInteger(
      'CLOUDFLARE_R2_UPLOAD_TTL_SECONDS',
      DEFAULT_UPLOAD_TTL_SECONDS,
    );
    this.maxSingleUploadBytes = this.readPositiveInteger(
      'CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES',
      DEFAULT_MAX_SINGLE_UPLOAD_BYTES,
    );
    this.maxMultipartPartBytes = this.readPositiveInteger(
      'CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES',
      DEFAULT_MAX_MULTIPART_PART_BYTES,
    );
    this.sourceFetchTimeoutMs = this.readPositiveInteger(
      'CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS',
      DEFAULT_SOURCE_FETCH_TIMEOUT_MS,
    );
    this.sourceHosts = this.readCommaSeparated('CLOUDFLARE_R2_SOURCE_HOSTS');
  }

  async generateUploadUrl(
    filename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const sanitisedFilename = this.sanitiseFilename(filename);
    const key = `voice_notes/${randomUUID()}_${sanitisedFilename}`;
    return {
      uploadUrl: this.createSignedUploadUrl({
        key,
        contentType,
        maximumBytes: this.maxSingleUploadBytes,
      }),
      publicUrl: this.publicUrlForKey(key),
    };
  }

  createObjectUploadUrl(
    key: string,
    contentType: string,
    maximumBytes = this.maxSingleUploadBytes,
  ): { uploadUrl: string; publicUrl: string } {
    this.validateObjectKey(key);
    this.validateContentType(contentType);
    this.validateUploadMaximum(maximumBytes, this.maxSingleUploadBytes);
    return {
      uploadUrl: this.createSignedUploadUrl({
        key,
        contentType,
        maximumBytes,
      }),
      publicUrl: this.publicUrlForKey(key),
    };
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<MultipartUploadHandle> {
    this.validateObjectKey(key);
    this.validateContentType(contentType);
    return this.requestJson<MultipartUploadHandle>(
      '/v1/multipart',
      {
        method: 'POST',
        headers: this.serviceJsonHeaders(),
        body: JSON.stringify({ key, contentType }),
      },
      isMultipartUploadHandle,
    );
  }

  createMultipartPartUploadUrl(
    handle: MultipartUploadHandle,
    partNumber: number,
    maximumBytes = this.maxMultipartPartBytes,
  ): string {
    this.validateObjectKey(handle.key);
    this.validateUploadId(handle.uploadId);
    this.validatePartNumber(partNumber);
    this.validateUploadMaximum(maximumBytes, this.maxMultipartPartBytes);

    const path = `/v1/multipart/${encodeURIComponent(
      handle.uploadId,
    )}/parts/${partNumber}`;
    return this.createSignedUploadUrl(
      {
        key: handle.key,
        contentType: 'application/octet-stream',
        maximumBytes,
        uploadId: handle.uploadId,
        partNumber,
      },
      path,
      { key: handle.key },
    );
  }

  async completeMultipartUpload(
    handle: MultipartUploadHandle,
    parts: MultipartUploadedPart[],
  ): Promise<StoredObjectMetadata> {
    this.validateObjectKey(handle.key);
    this.validateUploadId(handle.uploadId);
    this.validateUploadedParts(parts);

    return this.requestJson<StoredObjectMetadata>(
      `/v1/multipart/${encodeURIComponent(handle.uploadId)}/complete`,
      {
        method: 'POST',
        headers: this.serviceJsonHeaders(),
        body: JSON.stringify({ key: handle.key, parts }),
      },
      isStoredObjectMetadata,
    );
  }

  async abortMultipartUpload(handle: MultipartUploadHandle): Promise<void> {
    this.validateObjectKey(handle.key);
    this.validateUploadId(handle.uploadId);
    const url = this.gatewayUrl(
      `/v1/multipart/${encodeURIComponent(handle.uploadId)}`,
    );
    url.searchParams.set('key', handle.key);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.serviceHeaders(),
      signal: AbortSignal.timeout(this.sourceFetchTimeoutMs),
    });
    await this.assertGatewaySuccess(response);
  }

  async headObject(key: string): Promise<{
    key: string;
    etag: string;
    size: number;
    contentType: string | null;
    uploadedAt: string | null;
  }> {
    this.validateObjectKey(key);
    const response = await fetch(this.objectGatewayUrl(key), {
      method: 'HEAD',
      headers: this.serviceHeaders(),
      signal: AbortSignal.timeout(this.sourceFetchTimeoutMs),
    });
    await this.assertGatewaySuccess(response);

    return {
      key: response.headers.get('x-r2-key') ?? key,
      etag: response.headers.get('etag') ?? '',
      size: this.parseNonNegativeInteger(
        response.headers.get('content-length'),
        'R2 object size',
      ),
      contentType: response.headers.get('content-type'),
      uploadedAt: response.headers.get('x-r2-uploaded-at'),
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.validateObjectKey(key);
    const response = await fetch(this.objectGatewayUrl(key), {
      method: 'DELETE',
      headers: this.serviceHeaders(),
      signal: AbortSignal.timeout(this.sourceFetchTimeoutMs),
    });
    await this.assertGatewaySuccess(response);
  }

  async uploadFromUrl(key: string, sourceUrl: string): Promise<string> {
    this.validateObjectKey(key);
    const source = await this.downloadSource(sourceUrl);
    const upload = this.createObjectUploadUrl(
      key,
      source.contentType,
      source.bytes.byteLength,
    );
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': source.contentType,
        'Content-Length': String(source.bytes.byteLength),
      },
      body: Buffer.from(source.bytes),
      signal: AbortSignal.timeout(this.sourceFetchTimeoutMs),
    });
    const metadata = await this.readGatewayJson(
      response,
      isStoredObjectMetadata,
    );
    return metadata.publicUrl;
  }

  private createSignedUploadUrl(
    parameters: SignedUploadParameters,
    path?: string,
    additionalQuery: Record<string, string> = {},
  ): string {
    this.validateObjectKey(parameters.key);
    this.validateContentType(parameters.contentType);
    const expires = Math.floor(Date.now() / 1000) + this.uploadTtlSeconds;
    const uploadId = parameters.uploadId ?? '';
    const partNumber = parameters.partNumber?.toString() ?? '';
    const payload = [
      'cloudflare-r2-upload-v1',
      'PUT',
      parameters.key,
      expires.toString(),
      this.normaliseContentType(parameters.contentType),
      parameters.maximumBytes.toString(),
      uploadId,
      partNumber,
    ].join('\n');
    const signature = createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('base64url');
    const uploadPath =
      path ?? `/v1/objects/${this.encodeObjectKey(parameters.key)}`;
    const url = this.gatewayUrl(uploadPath);
    url.searchParams.set('expires', expires.toString());
    url.searchParams.set(
      'contentType',
      this.normaliseContentType(parameters.contentType),
    );
    url.searchParams.set('maxBytes', parameters.maximumBytes.toString());
    url.searchParams.set('signature', signature);
    for (const [name, value] of Object.entries(additionalQuery)) {
      url.searchParams.set(name, value);
    }
    return url.toString();
  }

  private async downloadSource(sourceUrl: string): Promise<SourceDownload> {
    let currentUrl = this.parseAndValidateSourceUrl(sourceUrl);

    for (
      let redirectCount = 0;
      redirectCount <= MAX_SOURCE_REDIRECTS;
      redirectCount += 1
    ) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(this.sourceFetchTimeoutMs),
      });

      if (isRedirectStatus(response.status)) {
        if (redirectCount === MAX_SOURCE_REDIRECTS) {
          throw new Error('R2 source download exceeded the redirect limit');
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new Error('R2 source redirect did not include a location');
        }
        currentUrl = this.parseAndValidateSourceUrl(
          new URL(location, currentUrl).toString(),
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to download source for R2 upload: ${response.status} ${response.statusText}`,
        );
      }

      const declaredLength = response.headers.get('content-length');
      if (
        declaredLength &&
        this.parseNonNegativeInteger(declaredLength, 'source content length') >
          this.maxSingleUploadBytes
      ) {
        throw new Error('R2 source download exceeds the configured size limit');
      }

      const bytes = await this.readResponseBytes(
        response,
        this.maxSingleUploadBytes,
      );
      const contentType = this.normaliseContentType(
        response.headers.get('content-type') ?? 'application/octet-stream',
      );
      this.validateContentType(contentType);
      return { bytes, contentType };
    }

    throw new Error('R2 source download failed');
  }

  private async readResponseBytes(
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
        await reader.cancel('Source exceeds configured size limit');
        throw new Error('R2 source download exceeds the configured size limit');
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

  private parseAndValidateSourceUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('R2 source URL is invalid');
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('R2 source URL must use HTTP or HTTPS');
    }
    if (url.username || url.password) {
      throw new Error('R2 source URL must not contain credentials');
    }

    const hostname = url.hostname.toLowerCase();
    if (isPrivateOrLocalHostname(hostname)) {
      throw new Error('R2 source URL must not target a private or local host');
    }
    if (
      this.sourceHosts.length > 0 &&
      !this.sourceHosts.some((allowedHost) =>
        hostMatches(hostname, allowedHost),
      )
    ) {
      throw new Error('R2 source host is not allowlisted');
    }

    return url;
  }

  private objectGatewayUrl(key: string): URL {
    return this.gatewayUrl(`/v1/objects/${this.encodeObjectKey(key)}`);
  }

  private gatewayUrl(path: string): URL {
    return new URL(
      path.replace(/^\/+/, ''),
      ensureTrailingSlash(this.gatewayBaseUrl),
    );
  }

  private publicUrlForKey(key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/${this.encodeObjectKey(key)}`;
  }

  private encodeObjectKey(key: string): string {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private sanitiseFilename(filename: string): string {
    const sanitised = filename
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 180);
    return sanitised || 'upload.bin';
  }

  private validateObjectKey(key: string): void {
    if (!key || key.length > MAX_KEY_LENGTH) {
      throw new Error('R2 object key length is invalid');
    }
    if (
      key.startsWith('/') ||
      key.includes('\\') ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/.test(key) ||
      key.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('R2 object key is invalid');
    }
  }

  private validateContentType(value: string): void {
    const contentType = this.normaliseContentType(value);
    if (
      !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(
        contentType,
      )
    ) {
      throw new Error('R2 content type is invalid');
    }
  }

  private normaliseContentType(value: string): string {
    return value.split(';', 1)[0].trim().toLowerCase();
  }

  private validateUploadMaximum(
    value: number,
    configuredMaximum: number,
  ): void {
    if (
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > configuredMaximum
    ) {
      throw new Error('R2 upload size limit is invalid');
    }
  }

  private validateUploadId(uploadId: string): void {
    if (
      !uploadId ||
      uploadId.length > 512 ||
      // eslint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f]/.test(uploadId)
    ) {
      throw new Error('R2 multipart upload ID is invalid');
    }
  }

  private validatePartNumber(partNumber: number): void {
    if (
      !Number.isSafeInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > 10_000
    ) {
      throw new Error('R2 multipart part number is invalid');
    }
  }

  private validateUploadedParts(parts: MultipartUploadedPart[]): void {
    if (!parts.length || parts.length > 10_000) {
      throw new Error('R2 multipart parts are invalid');
    }
    const partNumbers = new Set<number>();
    for (const part of parts) {
      this.validatePartNumber(part.partNumber);
      if (
        !part.etag ||
        part.etag.length > 512 ||
        partNumbers.has(part.partNumber)
      ) {
        throw new Error('R2 multipart parts are invalid');
      }
      partNumbers.add(part.partNumber);
    }
  }

  private serviceHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.serviceToken}`,
    };
  }

  private serviceJsonHeaders(): HeadersInit {
    return {
      ...this.serviceHeaders(),
      'Content-Type': 'application/json',
    };
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    predicate: (value: unknown) => value is T,
  ): Promise<T> {
    const response = await fetch(this.gatewayUrl(path), {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(this.sourceFetchTimeoutMs),
    });
    return this.readGatewayJson(response, predicate);
  }

  private async readGatewayJson<T>(
    response: Response,
    predicate: (value: unknown) => value is T,
  ): Promise<T> {
    await this.assertGatewaySuccess(response);
    const payload: unknown = await response.json();
    if (!predicate(payload)) {
      throw new R2GatewayError(
        502,
        'GATEWAY_RESPONSE_INVALID',
        'Cloudflare R2 gateway returned an invalid response',
      );
    }
    return payload;
  }

  private async assertGatewaySuccess(response: Response): Promise<void> {
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
      // Keep the bounded status-only failure when the gateway body is not JSON.
    }
    throw new R2GatewayError(response.status, code, message);
  }

  private readRequiredUrl(key: string): URL {
    const value = this.readRequiredString(key);
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
    const value = this.readRequiredString(key);
    if (value.length < 32) {
      throw new Error(`${key} must contain at least 32 characters`);
    }
    return value;
  }

  private readRequiredString(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`${key} must be configured`);
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

  private readCommaSeparated(key: string): string[] {
    const value = this.configService.get<string>(key) ?? '';
    return value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  private parseNonNegativeInteger(value: string | null, field: string): number {
    if (value === null) {
      return 0;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new R2GatewayError(
        502,
        'GATEWAY_RESPONSE_INVALID',
        `${field} is invalid`,
      );
    }
    return parsed;
  }
}

function ensureTrailingSlash(url: URL): string {
  const value = url.toString();
  return value.endsWith('/') ? value : `${value}/`;
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  if (allowedHost.startsWith('*.')) {
    const suffix = allowedHost.slice(1);
    return hostname.endsWith(suffix) && hostname !== suffix.slice(1);
  }
  return hostname === allowedHost;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return true;
  }

  const ipv4 = hostname.split('.').map((part) => Number(part));
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [first, second] = ipv4;
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMultipartUploadHandle(
  value: unknown,
): value is MultipartUploadHandle {
  return (
    isRecord(value) &&
    typeof value['key'] === 'string' &&
    typeof value['uploadId'] === 'string'
  );
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
