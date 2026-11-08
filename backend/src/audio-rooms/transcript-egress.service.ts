import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { EgressClient, StreamOutput, StreamProtocol } from 'livekit-server-sdk';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
import { SpeechTranscriptionService } from '../nlp/speech-transcription.service';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly cloudflareStream: CloudflareStreamService,
    private readonly speechTranscription: SpeechTranscriptionService,
    @InjectPinoLogger(TranscriptEgressService.name)
    private readonly logger: PinoLogger,
  ) {
    const livekitUrl =
      this.configService.get<string>('LIVEKIT_URL') ||
      'https://mock.livekit.cloud';
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const secretKey = this.configService.get<string>('LIVEKIT_SECRET');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (!apiKey || !secretKey) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured');
    }

    if (env === 'production') {
      if (
        apiKey === 'test-livekit-api-key' ||
        apiKey === 'dev_livekit_key_test_value_123' ||
        secretKey === 'test-livekit-secret' ||
        secretKey === 'dev_livekit_secret_test_value_123'
      ) {
        throw new Error(
          'LIVEKIT_API_KEY and LIVEKIT_SECRET must be securely configured in production',
        );
      }
    }
    this.egressClient = new EgressClient(livekitUrl, apiKey, secretKey);
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
    const result = await this.speechTranscription.transcribeAudioUrl(audioUrl);
    return result.status === 'ready' ? result.transcript : '';
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
