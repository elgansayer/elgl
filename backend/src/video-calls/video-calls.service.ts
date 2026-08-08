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

@Injectable()
export class VideoCallsService {
  private readonly logger = new Logger(VideoCallsService.name);
  private roomService: RoomServiceClient;
  private readonly LIVEXIT_SERVICE_NAME = 'livekit';

  constructor(
    private configService: ConfigService,
    private degradationService: VideoCallsDegradationService,
  ) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
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
        await this.roomService.createRoom(createOptions);
        const token = await this.generateToken(userId, roomName, true);
        this.degradationService.cacheToken(roomName, userId, token);
        return { token, roomName };
      },
      async () => {
        // Fallback: generate a standalone token without LiveKit room creation
        // The room creation failed, so we generate a token for a
        // best-effort peer-to-peer connection
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
        const token = await this.generateToken(userId, roomName, true);
        this.degradationService.cacheToken(roomName, userId, token);
        return { token, roomName };
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
