import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { EgressClient, StreamOutput, StreamProtocol } from 'livekit-server-sdk';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';

const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 10 * 60 * 1000;
const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

interface ActiveRecording {
  egressId: string;
  liveInputId: string;
}

/**
 * Manages LiveKit Egress operations for audio room recordings.
 *
 * LiveKit publishes a RoomComposite RTMPS stream to a short-lived Cloudflare
 * Stream live input. Cloudflare records it automatically and exposes an M4A
 * download used by the transcription provider. The application never uses an
 * AWS SDK, AWS service, S3 upload object or R2 access key for room recordings.
 *
 * The in-memory map is a temporary compatibility boundary. #7448 will move
 * active recording state and recovery into the durable job platform.
 */
@Injectable()
export class TranscriptEgressService {
  private readonly egressClient: EgressClient;
  private readonly activeRecordings = new Map<string, ActiveRecording>();
  private readonly transcriptionTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudflareStream: CloudflareStreamService,
    @InjectPinoLogger(TranscriptEgressService.name)
    private readonly logger: PinoLogger,
  ) {
    const livekitUrl =
      this.configService.get<string>('LIVEKIT_URL') ||
      'https://mock.livekit.cloud';
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const secretKey = this.configService.get<string>('LIVEKIT_SECRET');
    if (!apiKey || !secretKey) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured');
    }

    this.egressClient = new EgressClient(livekitUrl, apiKey, secretKey);
    this.transcriptionTimeoutMs = this.readPositiveInteger(
      'AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS',
      DEFAULT_TRANSCRIPTION_TIMEOUT_MS,
    );
  }

  /**
   * Starts a room-composite RTMPS egress into Cloudflare Stream.
   * Returns the LiveKit egress ID, or an empty string when recording could not
   * be started. Failure is truthful and never fabricates a recording URL.
   */
  async startEgress(roomName: string): Promise<string> {
    if (this.activeRecordings.has(roomName)) {
      this.logger.warn({ roomName }, 'Room recording is already active');
      return this.activeRecordings.get(roomName)?.egressId ?? '';
    }

    let liveInputId: string | null = null;
    try {
      const liveInput = await this.cloudflareStream.createLiveInput(roomName);
      liveInputId = liveInput.inputId;
      const streamOutput = new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [liveInput.rtmpsUrl],
      });
      const result = await this.egressClient.startRoomCompositeEgress(
        roomName,
        { stream: streamOutput },
      );
      const egressId = result.egressId;
      if (!egressId) {
        throw new Error('LiveKit did not return an egress ID');
      }

      this.activeRecordings.set(roomName, {
        egressId,
        liveInputId: liveInput.inputId,
      });
      this.logger.info(
        { roomName, egressId, liveInputId: liveInput.inputId },
        'Cloudflare Stream room recording started',
      );
      return egressId;
    } catch (error: unknown) {
      if (liveInputId) {
        await this.cloudflareStream
          .deleteLiveInput(liveInputId)
          .catch(() => undefined);
      }
      this.logger.warn(
        { roomName, error: safeErrorMessage(error) },
        'Room recording could not be started',
      );
      return '';
    }
  }

  /**
   * Stops LiveKit egress, waits for Cloudflare Stream to finish the automatic
   * recording, and returns an M4A download URL suitable for transcription.
   */
  async stopEgress(roomName: string): Promise<string | null> {
    const active = this.activeRecordings.get(roomName);
    if (!active) {
      this.logger.warn({ roomName }, 'No active room recording was found');
      return null;
    }

    this.activeRecordings.delete(roomName);
    try {
      await this.egressClient.stopEgress(active.egressId);
      const recording = await this.cloudflareStream.waitForRecording(
        active.liveInputId,
      );
      this.logger.info(
        {
          roomName,
          egressId: active.egressId,
          liveInputId: active.liveInputId,
          streamVideoId: recording.videoId,
        },
        'Cloudflare Stream room recording completed',
      );
      return recording.audioDownloadUrl;
    } catch (error: unknown) {
      this.logger.warn(
        {
          roomName,
          egressId: active.egressId,
          liveInputId: active.liveInputId,
          error: safeErrorMessage(error),
        },
        'Room recording could not be finalised',
      );
      return null;
    } finally {
      await this.cloudflareStream
        .deleteLiveInput(active.liveInputId)
        .catch((error: unknown) => {
          this.logger.warn(
            {
              roomName,
              liveInputId: active.liveInputId,
              error: safeErrorMessage(error),
            },
            'Cloudflare Stream live input cleanup failed',
          );
        });
    }
  }

  /**
   * Transcribes an authoritative recording URL using Azure Speech batch
   * transcription. A missing provider or failed job returns an empty result;
   * it never returns a simulated transcript or claims that transcription was
   * successful.
   */
  async generateTranscriptFromAudioUrl(audioUrl: string): Promise<string> {
    const azureKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    const region =
      this.configService.get<string>('AZURE_SPEECH_REGION') ?? 'eastus';

    if (!azureKey) {
      this.logger.warn(
        'Azure Speech is not configured; transcription is unavailable',
      );
      return '';
    }

    let jobUrl: string | null = null;
    try {
      const createResponse = await fetch(
        `https://${region}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            contentUrls: [audioUrl],
            locale: 'en-US',
            displayName: `Audio Room Transcription ${Date.now()}`,
            properties: {
              wordLevelTimestampsEnabled: false,
              displayFormWordLevelTimestampsEnabled: false,
            },
          }),
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        },
      );

      if (!createResponse.ok) {
        this.logger.warn(
          { status: createResponse.status },
          'Azure Speech transcription job creation failed',
        );
        return '';
      }

      const jobData: unknown = await createResponse.json();
      if (!isAzureJobReference(jobData)) {
        this.logger.warn('Azure Speech returned an invalid job reference');
        return '';
      }
      jobUrl = jobData.self;

      const completed = await this.waitForAzureJob(jobUrl, azureKey);
      if (!completed?.links?.files) {
        return '';
      }

      const filesResponse = await fetch(completed.links.files, {
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      });
      if (!filesResponse.ok) {
        this.logger.warn(
          { status: filesResponse.status },
          'Azure Speech result-file listing failed',
        );
        return '';
      }

      const filesData: unknown = await filesResponse.json();
      if (!isAzureFilesResponse(filesData)) {
        this.logger.warn('Azure Speech returned an invalid result-file list');
        return '';
      }
      const transcriptionFile = filesData.values.find(
        (file) => file.kind === 'Transcription',
      );
      if (!transcriptionFile) {
        this.logger.warn('Azure Speech returned no transcription result file');
        return '';
      }

      const transcriptResponse = await fetch(
        transcriptionFile.links.contentUrl,
        { signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) },
      );
      if (!transcriptResponse.ok) {
        this.logger.warn(
          { status: transcriptResponse.status },
          'Azure Speech transcript download failed',
        );
        return '';
      }

      const transcriptData: unknown = await transcriptResponse.json();
      if (!isAzureTranscript(transcriptData)) {
        this.logger.warn('Azure Speech returned an invalid transcript payload');
        return '';
      }
      return transcriptData.combinedRecognizedPhrases
        .map((phrase) => phrase.display)
        .filter(Boolean)
        .join('\n');
    } catch (error: unknown) {
      this.logger.error(
        { error: safeErrorMessage(error) },
        'Audio-room transcription failed',
      );
      return '';
    } finally {
      if (jobUrl) {
        await fetch(jobUrl, {
          method: 'DELETE',
          headers: { 'Ocp-Apim-Subscription-Key': azureKey },
          signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
        }).catch(() => undefined);
      }
    }
  }

  private async waitForAzureJob(
    jobUrl: string,
    azureKey: string,
  ): Promise<AzureJobStatus | null> {
    const deadline = Date.now() + this.transcriptionTimeoutMs;
    let pollDelayMs = 5000;

    while (Date.now() < deadline) {
      await delay(pollDelayMs);
      pollDelayMs = Math.min(Math.floor(pollDelayMs * 1.5), 30000);

      const response = await fetch(jobUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          { status: response.status },
          'Azure Speech transcription polling failed',
        );
        return null;
      }

      const payload: unknown = await response.json();
      if (!isAzureJobStatus(payload)) {
        this.logger.warn('Azure Speech returned an invalid job status');
        return null;
      }
      if (payload.status === 'Succeeded') {
        return payload;
      }
      if (payload.status !== 'Running' && payload.status !== 'NotStarted') {
        this.logger.warn(
          { status: payload.status },
          'Azure Speech transcription did not succeed',
        );
        return null;
      }
    }

    this.logger.warn('Azure Speech transcription timed out');
    return null;
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

interface AzureJobStatus {
  status: string;
  links?: { files?: string };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAzureJobReference(value: unknown): value is { self: string } {
  return isRecord(value) && typeof value['self'] === 'string';
}

function isAzureJobStatus(value: unknown): value is AzureJobStatus {
  if (!isRecord(value) || typeof value['status'] !== 'string') {
    return false;
  }
  if (
    value['links'] !== undefined &&
    (!isRecord(value['links']) ||
      (value['links']['files'] !== undefined &&
        typeof value['links']['files'] !== 'string'))
  ) {
    return false;
  }
  return true;
}

function isAzureFilesResponse(value: unknown): value is {
  values: Array<{ kind: string; links: { contentUrl: string } }>;
} {
  return (
    isRecord(value) &&
    Array.isArray(value['values']) &&
    value['values'].every(
      (file) =>
        isRecord(file) &&
        typeof file['kind'] === 'string' &&
        isRecord(file['links']) &&
        typeof file['links']['contentUrl'] === 'string',
    )
  );
}

function isAzureTranscript(
  value: unknown,
): value is { combinedRecognizedPhrases: Array<{ display: string }> } {
  return (
    isRecord(value) &&
    Array.isArray(value['combinedRecognizedPhrases']) &&
    value['combinedRecognizedPhrases'].every(
      (phrase) => isRecord(phrase) && typeof phrase['display'] === 'string',
    )
  );
}
