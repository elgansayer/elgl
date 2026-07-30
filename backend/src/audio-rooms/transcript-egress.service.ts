import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EgressClient,
  EncodedFileOutput,
  RoomCompositeEgressRequest,
  S3Upload,
} from 'livekit-server-sdk';

/**
 * Manages LiveKit Egress operations for audio room recordings.
 * Uses an in‑memory map to track running egresses (room_name → egress_id).
 */
@Injectable()
export class TranscriptEgressService {
  private readonly logger = new Logger(TranscriptEgressService.name);
  private readonly egressClient: EgressClient;

  /** room_name → egress_id  (in‑memory; restarts lose unfinished egresses) */
  private readonly egressMap = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    const livekitUrl =
      this.configService.get<string>('LIVEKIT_URL') ||
      'https://mock.livekit.cloud';
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const secretKey =
      this.configService.get<string>('LIVEKIT_SECRET') ||
      'secretkey012345678901234567890123456789';

    this.egressClient = new EgressClient(livekitUrl, apiKey, secretKey);
  }

  /**
   * Starts a RoomCompositeEgress for the given livekit room.
   * The resulting video file is uploaded to an S3‑compatible bucket (R2 by default).
   * Returns the LiveKit egress ID.
   */
  async startEgress(roomName: string): Promise<string> {
    // Build S3 upload target using R2 configuration from env
    const r2Endpoint =
      this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT') || '';
    const r2AccessKey =
      this.configService.get<string>('CLOUDFLARE_R2_ACCESS_KEY_ID') || '';
    const r2Secret =
      this.configService.get<string>('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '';
    const r2Bucket =
      this.configService.get<string>('CLOUDFLARE_R2_BUCKET') || 'recordings';

    const s3Upload: S3Upload = {
      bucket: r2Bucket,
      region: 'auto',
      endpoint: r2Endpoint,
      access_key: r2AccessKey,
      secret: r2Secret,
      force_path_style: true,
    };

    const fileOutput: EncodedFileOutput = {
      file_type: 'mp4',
      filepath: `audio-rooms/${roomName}/${Date.now()}.mp4`,
      s3: s3Upload,
    };

    const request: RoomCompositeEgressRequest = {
      room_name: roomName,
      file_outputs: [fileOutput],
      // optional: audio_only  – set to true if you only want audio
      audio_only: false,
    };

    try {
      const result = await this.egressClient.startRoomCompositeEgress(request);
      const egressId = result.egress_id;
      this.egressMap.set(roomName, egressId);
      this.logger.log(
        `Egress started for room "${roomName}" – id: ${egressId}`,
      );
      return egressId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`startEgress failed for room "${roomName}": ${msg}`);
      return ''; // non‑fatal – continue without egress
    }
  }

  /**
   * Stops the running egress for the given room and returns the resulting recording URL.
   * The URL is obtained from the stopped egress’s output list.
   */
  async stopEgress(roomName: string): Promise<string | null> {
    const egressId = this.egressMap.get(roomName);
    if (!egressId) {
      this.logger.warn(`No running egress found for room "${roomName}"`);
      return null;
    }

    try {
      const result = await this.egressClient.stopEgress(egressId);
      this.egressMap.delete(roomName);

      // The payload differs between versions; fall back to a synthetic URL if not found.
      if (result.file?.filename) {
        return result.file.filename;
      }
      if (result.file_results?.[0]?.filename) {
        return result.file_results[0].filename;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`stopEgress failed for room "${roomName}": ${msg}`);
    }

    // cleaned up even if API call failed
    this.egressMap.delete(roomName);
    return null;
  }

  /**
   * Transcribes the audio recording located at the given URL.
   * In production this should call Azure Speech Services or similar.
   * Returns a mock transcript for development purposes.
   */
  async generateTranscriptFromAudioUrl(audioUrl: string): Promise<string> {
    this.logger.log(`Generating transcript for audio URL: ${audioUrl}`);
    // TODO: replace with real Azure Speech-to-Text integration
    return (
      'This is a simulated transcript for the audio recording.\n' +
      'Speaker 1: Welcome to the room.\n' +
      'Speaker 2: Thank you.'
    );
  }
}
