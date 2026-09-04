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
  audioDownloadUrl: string;
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

  private async createAndWaitForAudioDownload(
    videoId: string,
    deadline: number,
  ): Promise<string> {
    this.validateIdentifier(videoId, 'video ID');
    await this.request<CloudflareDownloadsResult>(
      `/stream/${encodeURIComponent(videoId)}/downloads/audio`,
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
      const audio = downloads.audio;
      if (audio?.status.toLowerCase() === 'ready' && audio.url) {
        return audio.url;
      }
      lastStatus = audio?.status ?? 'not-found';
      await delay(this.pollIntervalMs);
    }

    throw new Error(
      `Cloudflare Stream audio download did not become ready before timeout (last state: ${lastStatus})`,
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
