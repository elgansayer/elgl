import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  CreateOptions,
} from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class VideoCallsService {
  private roomService: RoomServiceClient;

  constructor(
    private configService: ConfigService,
    private readonly metricsService: MetricsService,
    @InjectPinoLogger(VideoCallsService.name)
    private readonly logger: PinoLogger,
  ) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
    );
  }

  async createRoom(
    userId: string,
  ): Promise<{ token: string; roomName: string }> {
    const roomName = `video_${uuidv4()}`;
    const startTime = Date.now();

    const createOptions: CreateOptions = {
      name: roomName,
      emptyTimeout: 30,
      maxParticipants: 2,
    };

    try {
      await this.roomService.createRoom(createOptions);
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.recordVideoRoomCreated('success', durationSeconds);
      this.logger.info({ roomName, userId }, 'Video classroom created');
    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.recordVideoRoomCreated('error', durationSeconds);
      this.metricsService.recordVideoRoomCreationError(
        (error as Error).name || 'unknown',
      );
      this.logger.error({ error: (error as Error).message, roomName, userId }, 'Failed to create video classroom');
      throw error;
    }

    const token = await this.generateToken(userId, roomName, true);

    return { token, roomName };
  }

  async joinRoom(
    userId: string,
    roomName: string,
  ): Promise<{ token: string; roomName: string }> {
    const token = await this.generateToken(userId, roomName, true);
    this.metricsService.recordVideoRoomJoin();
    return { token, roomName };
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
