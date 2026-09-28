import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  CreateOptions,
} from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';
import {
  VideoCallsDegradationService,
  DegradationMarker,
} from './video-calls-degradation.service';
import { VideoCallsEncryptionService } from './video-calls-encryption.service';
import { LivekitService, IceServer } from '../livekit/livekit.service';
import { MetricsService } from '../metrics/metrics.service';

export interface EncryptedVideoCallResponse {
  token: string;
  roomName: string;
  e2eeKey: string;
  iceServers: IceServer[];
  degraded?: boolean;
  degradationReason?: string;
}

@Injectable()
export class VideoCallsService {
  private readonly logger = new Logger(VideoCallsService.name);
  private roomService: RoomServiceClient;
  private readonly LIVEXIT_SERVICE_NAME = 'livekit';

  constructor(
    private configService: ConfigService,
    private degradationService: VideoCallsDegradationService,
    private encryptionService: VideoCallsEncryptionService,
    private livekitService: LivekitService,
    private readonly metricsService: MetricsService,
  ) {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const secret = this.configService.get<string>('LIVEKIT_SECRET');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (env === 'production') {
      if (!apiKey || !secret) {
        throw new Error(
          'LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured in production',
        );
      }
    }

    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      apiKey,
      secret,
    );
  }

  async createRoom(
    userId: string,
    remoteUserId: string,
  ): Promise<EncryptedVideoCallResponse> {
    const roomName = `video_${uuidv4()}`;
    const marker: DegradationMarker = {
      degraded: false,
      fallbackSource: 'none',
    };

    const result = await this.degradationService.executeWithBreaker(
      this.LIVEXIT_SERVICE_NAME,
      async () => {
        const createOptions: CreateOptions = {
          name: roomName,
          emptyTimeout: 30,
          maxParticipants: 2,
        };

        try {
          await this.roomService.createRoom(createOptions);
        } catch (error) {
          const errorType =
            error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomCreationFailed(errorType);
          throw error;
        }

        const tokenStart = Date.now();
        try {
          const token = await this.generateToken(userId, roomName, true);
          this.degradationService.cacheToken(roomName, userId, token);
          this.metricsService.recordVideoClassroomTokenGenerationDuration(
            'create',
            (Date.now() - tokenStart) / 1000,
          );
          this.metricsService.recordVideoClassroomCreated();
          return { token, roomName };
        } catch (error) {
          const errorType =
            error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomCreationFailed(errorType);
          throw error;
        }
      },
      async () => {
        const token = await this.generateToken(userId, roomName, true);
        return { token, roomName };
      },
      marker,
    );

    // The media server must never receive the key. Persist it only in the
    // authenticated application signalling plane with the same TTL as the
    // LiveKit token, and fail closed if that secure key broker is unavailable.
    const e2eeKey = await this.encryptionService.createSession(
      roomName,
      userId,
      remoteUserId,
    );

    if (marker.degraded) {
      this.logger.warn(
        `createRoom degraded for user ${userId}: ${marker.reason}`,
      );
      await this.degradationService.recordDegradationEvent(
        '/video-calls/start',
        marker.reason ?? 'Unknown degradation',
        marker.fallbackSource ?? 'standalone',
        userId,
      );
    }

    return {
      ...result,
      e2eeKey,
      iceServers: this.livekitService.buildIceServers(),
      degraded: marker.degraded,
      degradationReason: marker.reason,
    };
  }

  async joinRoom(
    userId: string,
    roomName: string,
  ): Promise<EncryptedVideoCallResponse> {
    // Authorize against the encrypted call session before minting a LiveKit
    // token. This prevents knowledge of a room UUID from becoming admission.
    const e2eeKey = await this.encryptionService.getKeyForParticipant(
      roomName,
      userId,
    );

    const marker: DegradationMarker = {
      degraded: false,
      fallbackSource: 'none',
    };

    const result = await this.degradationService.executeWithBreaker(
      this.LIVEXIT_SERVICE_NAME,
      async () => {
        const tokenStart = Date.now();
        try {
          const token = await this.generateToken(userId, roomName, true);
          this.degradationService.cacheToken(roomName, userId, token);
          this.metricsService.recordVideoClassroomTokenGenerationDuration(
            'join',
            (Date.now() - tokenStart) / 1000,
          );
          this.metricsService.recordVideoClassroomJoined();
          return { token, roomName };
        } catch (error) {
          const errorType =
            error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomJoinFailed(errorType);
          throw error;
        }
      },
      async () => {
        const cachedToken = this.degradationService.getCachedToken(
          roomName,
          userId,
        );
        if (cachedToken) {
          return { token: cachedToken, roomName };
        }
        const token = await this.generateToken(userId, roomName, true);
        return { token, roomName };
      },
      marker,
    );

    if (marker.degraded) {
      this.logger.warn(
        `joinRoom degraded for user ${userId} room ${roomName}: ${marker.reason}`,
      );
      await this.degradationService.recordDegradationEvent(
        '/video-calls/accept',
        marker.reason ?? 'Unknown degradation',
        marker.fallbackSource ?? 'standalone',
        userId,
      );
    }

    return {
      ...result,
      e2eeKey,
      iceServers: this.livekitService.buildIceServers(),
      degraded: marker.degraded,
      degradationReason: marker.reason,
    };
  }

  private async generateToken(
    userId: string,
    roomName: string,
    canPublish: boolean,
  ): Promise<string> {
    const at = new AccessToken(
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
      {
        identity: userId,
        ttl: '1h',
      },
    );

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }
}
