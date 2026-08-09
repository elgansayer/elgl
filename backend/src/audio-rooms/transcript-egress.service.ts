import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'livekit-server-sdk';

/**
 * Manages LiveKit Egress operations for audio room recordings.
 * Uses an in‑memory map to track running egresses (room_name → egress_id).
 */
@Injectable()
export class TranscriptEgressService {
  private readonly egressClient: EgressClient;

  /** room_name → egress_id  (in‑memory; restarts lose unfinished egresses) */
  private readonly egressMap = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
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

    const s3Upload = new S3Upload({
      bucket: r2Bucket,
      region: 'auto',
      endpoint: r2Endpoint,
      accessKey: r2AccessKey,
      secret: r2Secret,
      forcePathStyle: true,
    });

    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `audio-rooms/${roomName}/${Date.now()}.mp4`,
      output: { case: 's3', value: s3Upload },
    });

    try {
      const result = await this.egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        { audioOnly: false },
      );
      const egressId = result.egressId;
      this.egressMap.set(roomName, egressId);
      this.logger.info(
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

      if (result.fileResults?.[0]?.filename) {
        return result.fileResults[0].filename;
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
    this.logger.info(`Generating transcript for audio URL: ${audioUrl}`);

    const azureKey = this.configService.get<string>('AZURE_SPEECH_KEY');
    const region =
      this.configService.get<string>('AZURE_SPEECH_REGION') ?? 'eastus';

    if (!azureKey) {
      this.logger.warn(
        'Azure Speech API key not configured. Returning mock transcript.',
      );
      return (
        'This is a simulated transcript for the audio recording.\n' +
        'Speaker 1: Welcome to the room.\n' +
        'Speaker 2: Thank you.'
      );
    }

    try {
      // Create a batch transcription job
      const url = `https://${region}.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions`;

      const createResponse = await fetch(url, {
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
      });

      if (!createResponse.ok) {
        const errorBody = await createResponse.text();
        this.logger.warn(
          `Azure Speech API error (create job): ${createResponse.status} ${errorBody}`,
        );
        return '';
      }

      const jobData = (await createResponse.json()) as { self: string };
      const jobUrl = jobData.self;

      // Poll for job completion
      let status = 'Running';
      let statusResponse: Response;
      let statusData: { status: string; links?: { files?: string } };

      while (status === 'Running' || status === 'NotStarted') {
        // Wait 5 seconds before checking status again
        await new Promise((resolve) => setTimeout(resolve, 5000));

        statusResponse = await fetch(jobUrl, {
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            Accept: 'application/json',
          },
        });

        if (!statusResponse.ok) {
          const errorBody = await statusResponse.text();
          this.logger.warn(
            `Azure Speech API error (poll job): ${statusResponse.status} ${errorBody}`,
          );
          return '';
        }

        statusData = (await statusResponse.json()) as {
          status: string;
          links?: { files?: string };
        };
        status = statusData.status;
      }

      if (status !== 'Succeeded') {
        this.logger.warn(
          `Azure Speech API transcription job failed with status: ${status}`,
        );
        return '';
      }

      // Fetch the files associated with the job
      if (!statusData!.links?.files) {
        this.logger.warn(
          'Azure Speech API transcription job succeeded but no files link returned',
        );
        return '';
      }

      const filesResponse = await fetch(statusData!.links.files, {
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          Accept: 'application/json',
        },
      });

      if (!filesResponse.ok) {
        const errorBody = await filesResponse.text();
        this.logger.warn(
          `Azure Speech API error (fetch files list): ${filesResponse.status} ${errorBody}`,
        );
        return '';
      }

      const filesData = (await filesResponse.json()) as {
        values: Array<{ kind: string; links: { contentUrl: string } }>;
      };

      const transcriptionFile = filesData.values.find(
        (f) => f.kind === 'Transcription',
      );
      if (!transcriptionFile) {
        this.logger.warn(
          'Azure Speech API transcription job succeeded but no transcription file found in results',
        );
        return '';
      }

      // Download the actual transcript
      const transcriptResponse = await fetch(
        transcriptionFile.links.contentUrl,
      );
      if (!transcriptResponse.ok) {
        const errorBody = await transcriptResponse.text();
        this.logger.warn(
          `Azure Speech API error (download transcript): ${transcriptResponse.status} ${errorBody}`,
        );
        return '';
      }

      const transcriptData = (await transcriptResponse.json()) as {
        combinedRecognizedPhrases?: Array<{ display: string }>;
      };

      const finalTranscript =
        transcriptData.combinedRecognizedPhrases?.[0]?.display ?? '';

      // Delete the job (cleanup)
      await fetch(jobUrl, {
        method: 'DELETE',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
        },
      });

      return finalTranscript;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error generating transcript: ${msg}`);
      return '';
    }
  }
}
