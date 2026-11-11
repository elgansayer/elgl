import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_RECORDING_TIMEOUT_MS = 120000;
const DEFAULT_DELETE_RECORDING_AFTER_DAYS = 1;

export interface CloudflareLiveInput {
  inputId: string;
  rtmpsUrl: string;
}

export interface CloudflareStreamRecording {
  videoId: string;
  playbackUrl: string | null;
  dashUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  audioDownloadUrl: string;
}

export interface CloudflareVideoPlayback {
  videoId: string;
  ready: boolean;
  state: string;
  hlsUrl: string | null;
  dashUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

export interface CloudflareVideoCopyMetadata {
  name: string;
  roomId?: string;
}

interface CloudflareApiEnvelope<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
  result: T;
}

interface CloudflareLiveInputResult {
  uid: string;
  rtmps: {
    url: string;
    streamKey: string;
  };
}

interface CloudflareVideoResult {
  uid: string;
  readyToStream?: boolean;
  status?: { state?: string };
  playback?: { hls?: string; dash?: string };
  thumbnail?: string;
  duration?: number;
}

interface CloudflareDownloadResult {
  status: string;
  url: string;
  percentComplete?: number;
}

interface CloudflareDownloadsResult {
  audio?: CloudflareDownloadResult;
  default?: CloudflareDownloadResult;
}

@Injectable()
export class CloudflareStreamService {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly allowedOrigins: string[];
  private readonly pollIntervalMs: number;
  private readonly recordingTimeoutMs: number;
  private readonly deleteRecordingAfterDays: number;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.readRequiredString('CLOUDFLARE_STREAM_ACCOUNT_ID');
    this.apiToken = this.readRequiredSecret('CLOUDFLARE_STREAM_API_TOKEN');

    const env = this.configService.get<string>('NODE_ENV') || 'development';
    if (env === 'production') {
      if (this.apiToken === 'test-cloudflare-stream-api-token') {
        throw new Error(
          'CLOUDFLARE_STREAM_API_TOKEN must be securely configured in production',
        );
      }
    }

    this.allowedOrigins = this.readCommaSeparated(
      'CLOUDFLARE_STREAM_ALLOWED_ORIGINS',
    );
    this.pollIntervalMs = this.readPositiveInteger(
      'CLOUDFLARE_STREAM_POLL_INTERVAL_MS',
      DEFAULT_POLL_INTERVAL_MS,
    );
    this.recordingTimeoutMs = this.readPositiveInteger(
      'CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS',
      DEFAULT_RECORDING_TIMEOUT_MS,
    );
    this.deleteRecordingAfterDays = this.readPositiveInteger(
      'CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS',
      DEFAULT_DELETE_RECORDING_AFTER_DAYS,
    );
  }

  async createLiveInput(roomName: string): Promise<CloudflareLiveInput> {
    const safeRoomName = roomName.slice(0, 200);
    const result = await this.request<CloudflareLiveInputResult>(
      '/stream/live_inputs',
      {
        method: 'POST',
        body: JSON.stringify({
          meta: {
            name: `Audio room ${safeRoomName}`,
            roomName: safeRoomName,
          },
          recording: {
            mode: 'automatic',
            timeoutSeconds: 0,
            requireSignedURLs: false,
            allowedOrigins: this.allowedOrigins,
            hideLiveViewerCount: true,
          },
          deleteRecordingAfterDays: this.deleteRecordingAfterDays,
        }),
      },
      isCloudflareLiveInputResult,
    );

    return {
      inputId: result.uid,
      rtmpsUrl: joinRtmpsUrl(result.rtmps.url, result.rtmps.streamKey),
    };
  }

  async waitForRecording(inputId: string): Promise<CloudflareStreamRecording> {
    this.validateIdentifier(inputId, 'live input ID');
    const deadline = Date.now() + this.recordingTimeoutMs;
    let lastState = 'not-found';

    while (Date.now() < deadline) {
      const videos = await this.request<CloudflareVideoResult[]>(
        `/stream/live_inputs/${encodeURIComponent(inputId)}/videos`,
        { method: 'GET' },
        isCloudflareVideoResultArray,
      );
      const recording = videos.find(
        (video) =>
          video.readyToStream === true ||
          video.status?.state?.toLowerCase() === 'ready',
      );

      if (recording) {
        const audioDownloadUrl = await this.createAndWaitForAudioDownload(
          recording.uid,
          deadline,
        );
        return {
          videoId: recording.uid,
          playbackUrl: recording.playback?.hls ?? null,
          dashUrl: recording.playback?.dash ?? null,
          thumbnailUrl: recording.thumbnail ?? null,
          durationSeconds:
            typeof recording.duration === 'number' ? recording.duration : null,
          audioDownloadUrl,
        };
      }

      lastState = videos[0]?.status?.state ?? 'not-found';
      await delay(this.pollIntervalMs);
    }

    throw new Error(
      `Cloudflare Stream recording did not become ready before timeout (last state: ${lastState})`,
    );
  }

  async deleteLiveInput(inputId: string): Promise<void> {
    this.validateIdentifier(inputId, 'live input ID');
    await this.request<unknown>(
      `/stream/live_inputs/${encodeURIComponent(inputId)}`,
      { method: 'DELETE' },
      (val: unknown): val is unknown => true,
    );
  }

  /**
   * Copies an existing recording into Cloudflare Stream. Cloudflare performs
   * the on-the-fly HLS/DASH transcoding; the returned identifier is the durable
   * identity callers poll with `getVideoPlayback`.
   */
  async copyVideoFromUrl(
    sourceUrl: string,
    metadata: CloudflareVideoCopyMetadata,
  ): Promise<string> {
    assertSafeHttpsUrl(sourceUrl, 'source URL');
    const result = await this.request<CloudflareVideoResult>(
      '/stream/copy',
      {
        method: 'POST',
        body: JSON.stringify({
          url: sourceUrl,
          meta: {
            name: metadata.name.slice(0, 200),
            roomId: metadata.roomId?.slice(0, 200),
          },
          requireSignedURLs: false,
          allowedOrigins: this.allowedOrigins,
          thumbnailTimestampPct: 0.1,
        }),
      },
      isCloudflareVideoResult,
    );
    return result.uid;
  }

  async getVideoPlayback(videoId: string): Promise<CloudflareVideoPlayback> {
    this.validateIdentifier(videoId, 'video ID');
    const result = await this.request<CloudflareVideoResult>(
      `/stream/${encodeURIComponent(videoId)}`,
      { method: 'GET' },
      isCloudflareVideoResult,
    );
    const state = result.status?.state ?? (result.readyToStream ? 'ready' : '');
    return {
      videoId: result.uid,
      ready: result.readyToStream === true || state.toLowerCase() === 'ready',
      state: state || 'unknown',
      hlsUrl: result.playback?.hls ?? null,
      dashUrl: result.playback?.dash ?? null,
      thumbnailUrl: result.thumbnail ?? null,
      durationSeconds:
        typeof result.duration === 'number' ? result.duration : null,
    };
  }

  async deleteVideo(videoId: string): Promise<void> {
    this.validateIdentifier(videoId, 'video ID');
    await this.request<unknown>(
      `/stream/${encodeURIComponent(videoId)}`,
      { method: 'DELETE' },
      (val: unknown): val is unknown => true,
    );
  }

  /**
   * Creates and waits for the progressive MP4 derivative used when a browser
   * cannot play adaptive HLS/DASH natively. Failures are surfaced to the caller
   * so a replay is never advertised as playable without a working source.
   */
  async waitForDefaultDownload(
    videoId: string,
    timeoutMs = this.recordingTimeoutMs,
  ): Promise<string> {
    return this.createAndWaitForDownload(
      videoId,
      'default',
      Date.now() + timeoutMs,
    );
  }

  private async createAndWaitForAudioDownload(
    videoId: string,
    deadline: number,
  ): Promise<string> {
    return this.createAndWaitForDownload(videoId, 'audio', deadline);
  }

  private async createAndWaitForDownload(
    videoId: string,
    kind: 'audio' | 'default',
    deadline: number,
  ): Promise<string> {
    this.validateIdentifier(videoId, 'video ID');
    await this.request<CloudflareDownloadsResult>(
      `/stream/${encodeURIComponent(videoId)}/downloads/${kind}`,
      { method: 'POST' },
      isCloudflareDownloadsResult,
    );

    let lastStatus = 'not-started';
    while (Date.now() < deadline) {
      const downloads = await this.request<CloudflareDownloadsResult>(
        `/stream/${encodeURIComponent(videoId)}/downloads`,
        { method: 'GET' },
        isCloudflareDownloadsResult,
      );
      const download = downloads[kind];
      if (download?.status.toLowerCase() === 'ready' && download.url) {
        return download.url;
      }
      lastStatus = download?.status ?? 'not-found';
      await delay(this.pollIntervalMs);
    }

    throw new Error(
      `Cloudflare Stream ${kind} download did not become ready before timeout (last state: ${lastStatus})`,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    predicate: (value: unknown) => value is T,
  ): Promise<T> {
    const rawHeaders =
      init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : ((init.headers as Record<string, string> | undefined) ?? {});
    const headers: Record<string, string> = {
      ...rawHeaders,
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const response = await fetch(
      `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(
        this.accountId,
      )}${path}`,
      {
        ...init,
        headers,
        signal:
          init.signal ??
          AbortSignal.timeout(Math.min(this.recordingTimeoutMs, 30000)),
      },
    );

    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new Error(
        `Cloudflare Stream returned a non-JSON response (${response.status})`,
      );
    }

    if (!isCloudflareEnvelope(envelope)) {
      throw new Error('Cloudflare Stream returned an invalid API envelope');
    }
    if (!response.ok || !envelope.success) {
      const message =
        envelope.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join('; ') ||
        `Cloudflare Stream request failed with status ${response.status}`;
      throw new Error(message);
    }
    if (!predicate(envelope.result)) {
      throw new Error('Cloudflare Stream returned an invalid result payload');
    }
    return envelope.result;
  }

  private readRequiredString(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`${key} must be configured`);
    }
    return value;
  }

  private readRequiredSecret(key: string): string {
    const value = this.readRequiredString(key);
    if (value.length < 20) {
      throw new Error(`${key} must contain at least 20 characters`);
    }
    return value;
  }

  private readCommaSeparated(key: string): string[] {
    const value = this.configService.get<string>(key) ?? '';
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
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

  private validateIdentifier(value: string, label: string): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
      throw new Error(`Cloudflare Stream ${label} is invalid`);
    }
  }
}

function assertSafeHttpsUrl(value: string, label: string): void {
  if (value.length === 0 || value.length > 2048) {
    throw new Error(`Cloudflare Stream ${label} is invalid`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Cloudflare Stream ${label} is invalid`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`Cloudflare Stream ${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Cloudflare Stream ${label} must not contain credentials`);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'metadata.google.internal' ||
    isPrivateIpLiteral(host)
  ) {
    throw new Error(`Cloudflare Stream ${label} must be publicly reachable`);
  }
}

function isPrivateIpLiteral(host: string): boolean {
  if (host.includes(':')) {
    if (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    ) {
      return true;
    }

    // WHATWG URL normalises IPv4-mapped IPv6 literals to their hex form
    // (::ffff:127.0.0.1 becomes ::ffff:7f00:1), which would otherwise bypass
    // the IPv4 range checks below.
    const mappedIpv4 = ipv4FromMappedIpv6(host);
    return mappedIpv4 !== null && isPrivateIpv4(mappedIpv4);
  }

  return isPrivateIpv4(host);
}

function ipv4FromMappedIpv6(host: string): string | null {
  const prefix = '::ffff:';
  if (!host.startsWith(prefix)) return null;

  const suffix = host.slice(prefix.length);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(suffix)) return suffix;

  const hextets = suffix.split(':');
  if (hextets.length !== 2) return null;
  if (!hextets.every((hextet) => /^[0-9a-f]{1,4}$/.test(hextet))) return null;

  const high = Number.parseInt(hextets[0], 16);
  const low = Number.parseInt(hextets[1], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split('.');
  if (octets.length !== 4) return false;
  if (!octets.every((octet) => /^\d{1,3}$/.test(octet))) return false;

  const [first, second] = octets.map((octet) => Number(octet));
  if (first > 255 || second > 255) return false;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function joinRtmpsUrl(baseUrl: string, streamKey: string): string {
  if (!baseUrl.startsWith('rtmps://')) {
    throw new Error('Cloudflare Stream returned a non-RTMPS ingest URL');
  }
  if (!streamKey || containsControlCharacter(streamKey)) {
    throw new Error('Cloudflare Stream returned an invalid stream key');
  }
  return `${baseUrl.replace(/\/+$/, '')}/${streamKey}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCloudflareEnvelope(
  value: unknown,
): value is CloudflareApiEnvelope<unknown> {
  return (
    isRecord(value) &&
    typeof value['success'] === 'boolean' &&
    Object.prototype.hasOwnProperty.call(value, 'result')
  );
}

function isCloudflareLiveInputResult(
  value: unknown,
): value is CloudflareLiveInputResult {
  return (
    isRecord(value) &&
    typeof value['uid'] === 'string' &&
    isRecord(value['rtmps']) &&
    typeof value['rtmps']['url'] === 'string' &&
    typeof value['rtmps']['streamKey'] === 'string'
  );
}

function isCloudflareVideoResult(
  value: unknown,
): value is CloudflareVideoResult {
  if (!isRecord(value) || typeof value['uid'] !== 'string') {
    return false;
  }
  if (
    value['status'] !== undefined &&
    (!isRecord(value['status']) ||
      (value['status']['state'] !== undefined &&
        typeof value['status']['state'] !== 'string'))
  ) {
    return false;
  }
  return true;
}

function isCloudflareVideoResultArray(
  value: unknown,
): value is CloudflareVideoResult[] {
  return Array.isArray(value) && value.every(isCloudflareVideoResult);
}

function isCloudflareDownloadsResult(
  value: unknown,
): value is CloudflareDownloadsResult {
  if (!isRecord(value)) {
    return false;
  }
  for (const key of ['audio', 'default']) {
    const download = value[key];
    if (
      download !== undefined &&
      (!isRecord(download) ||
        typeof download['status'] !== 'string' ||
        typeof download['url'] !== 'string')
    ) {
      return false;
    }
  }
  return true;
}
