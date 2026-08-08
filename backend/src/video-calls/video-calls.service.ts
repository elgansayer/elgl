import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RoomServiceClient,
  AccessToken,
  CreateOptions,
} from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';
import {
  VideoCallsDegradationService,
  DegradationMarker,
} from './video-calls-degradation.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class VideoCallsService {
  private roomService: RoomServiceClient;
  private readonly logger = new Logger(VideoCallsService.name);
  private readonly LIVEXIT_SERVICE_NAME = 'livekit';

  constructor(
    private configService: ConfigService,
    private degradationService: VideoCallsDegradationService,
    private readonly metricsService: MetricsService,
  ) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY') as string,
      this.configService.get<string>('LIVEKIT_API_SECRET') as string,
    );
  }

  async createRoom(
    userId: string,
  ): Promise<{
    token: string;
    roomName: string;
    degraded?: boolean;
    degradationReason?: string;
  }> {
    const roomName = `video_${uuidv4()}`;
    const marker: DegradationMarker = { degraded: false, fallbackSource: 'none' };

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
          const errorType = error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomCreationFailed(errorType);
          throw error;
        }

        const tokenStart = Date.now();
        try {
          const token = await this.generateToken(userId, roomName, true);
          this.metricsService.recordVideoClassroomTokenGenerationDuration(
            'create',
            (Date.now() - tokenStart) / 1000,
          );
          this.degradationService.cacheToken(roomName, userId, token);
          this.metricsService.recordVideoClassroomCreated();
          return { token, roomName };
        } catch (error) {
          const errorType = error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomCreationFailed(errorType);
          throw error;
        }
      },
      async () => {
        // Fallback: generate a standalone token without LiveKit room creation
        const token = await this.generateToken(userId, roomName, true);
        return { token, roomName };
      },
      marker,
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
      degraded: marker.degraded,
      degradationReason: marker.reason,
    };
  }

  async joinRoom(
    userId: string,
    roomName: string,
  ): Promise<{
    token: string;
    roomName: string;
    degraded?: boolean;
    degradationReason?: string;
  }> {
    const marker: DegradationMarker = { degraded: false, fallbackSource: 'none' };

    const result = await this.degradationService.executeWithBreaker(
      this.LIVEXIT_SERVICE_NAME,
      async () => {
        const tokenStart = Date.now();
        try {
          const token = await this.generateToken(userId, roomName, true);
          this.metricsService.recordVideoClassroomTokenGenerationDuration(
            'join',
            (Date.now() - tokenStart) / 1000,
          );
          this.degradationService.cacheToken(roomName, userId, token);
          this.metricsService.recordVideoClassroomJoined();
          return { token, roomName };
        } catch (error) {
          const errorType = error instanceof Error ? error.constructor.name : 'unknown';
          this.metricsService.recordVideoClassroomJoinFailed(errorType);
          throw error;
        }
      },
      async () => {
        // Fallback: try cached token first, then generate a new one
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
      degraded: marker.degraded,
      degradationReason: marker.reason,
    };
  }

  private async generateToken(
    userId: string,
    roomName: string,
    isHost: boolean,
  ): Promise<string> {
    const at = new AccessToken(
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_API_SECRET'),
      {
        identity: userId,
      },
    );
    at.addGrant({ roomJoin: true, room: roomName, canPublish: isHost });
    return await at.toJwt();
  }
}
