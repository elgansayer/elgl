import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 10 * 60 * 1000;
const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export type SpeechTranscriptionResult =
  | { status: 'ready'; transcript: string }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'failed'; errorCode: string };

@Injectable()
export class SpeechTranscriptionService {
  private readonly logger = new Logger(SpeechTranscriptionService.name);
  private readonly transcriptionTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.transcriptionTimeoutMs = this.readPositiveInteger(
      'AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS',
      DEFAULT_TRANSCRIPTION_TIMEOUT_MS,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('AZURE_SPEECH_KEY')?.trim());
  }

  async transcribeAudioUrl(
    audioUrl: string,
  ): Promise<SpeechTranscriptionResult> {
    if (!this.isHttpsUrl(audioUrl)) {
      return { status: 'failed', errorCode: 'invalid_audio_url' };
    }

    const azureKey = this.configService.get<string>('AZURE_SPEECH_KEY')?.trim();
    const rawRegion =
      this.configService.get<string>('AZURE_SPEECH_REGION')?.trim() ?? 'eastus';
    const region = /^[a-z0-9-]+$/i.test(rawRegion) ? rawRegion : 'eastus';

    if (!azureKey) {
      this.logger.warn(
        'Azure Speech is not configured; transcription is unavailable',
      );
      return { status: 'unavailable' };
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
            displayName: `Voice Transcription ${Date.now()}`,
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
        return { status: 'failed', errorCode: 'provider_rejected' };
      }

      const jobData: unknown = await createResponse.json();
      if (!isAzureJobReference(jobData)) {
        this.logger.warn('Azure Speech returned an invalid job reference');
        return { status: 'failed', errorCode: 'invalid_provider_response' };
      }
      jobUrl = jobData.self;
      if (!this.isHttpsUrl(jobUrl)) {
        this.logger.warn('Azure Speech returned a non-HTTPS job reference');
        return { status: 'failed', errorCode: 'invalid_provider_response' };
      }

      const completed = await this.waitForAzureJob(jobUrl, azureKey);
      if (!completed?.links?.files || !this.isHttpsUrl(completed.links.files)) {
        return { status: 'failed', errorCode: 'provider_job_failed' };
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
        return { status: 'failed', errorCode: 'result_listing_failed' };
      }

      const filesData: unknown = await filesResponse.json();
      if (!isAzureFilesResponse(filesData)) {
        this.logger.warn('Azure Speech returned an invalid result-file list');
        return { status: 'failed', errorCode: 'invalid_provider_response' };
      }
      const transcriptionFile = filesData.values.find(
        (file) => file.kind === 'Transcription',
      );
      if (!transcriptionFile) {
        this.logger.warn('Azure Speech returned no transcription result file');
        return { status: 'failed', errorCode: 'result_missing' };
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
        return { status: 'failed', errorCode: 'result_download_failed' };
      }

      const transcriptData: unknown = await transcriptResponse.json();
      if (!isAzureTranscript(transcriptData)) {
        this.logger.warn('Azure Speech returned an invalid transcript payload');
        return { status: 'failed', errorCode: 'invalid_provider_response' };
      }

      const transcript = transcriptData.combinedRecognizedPhrases
        .map((phrase) => phrase.display.trim())
        .filter(Boolean)
        .join('\n');
      return transcript ? { status: 'ready', transcript } : { status: 'empty' };
    } catch {
      this.logger.error('Speech transcription provider request failed');
      return { status: 'failed', errorCode: 'provider_request_failed' };
    } finally {
      if (jobUrl && this.isHttpsUrl(jobUrl)) {
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
    if (!this.isHttpsUrl(jobUrl)) {
      this.logger.warn('Azure Speech job reference is not an HTTPS URL');
      return null;
    }
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

  private isHttpsUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

interface AzureJobStatus {
  status: string;
  links?: { files?: string };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
