import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  AccessToken,
  RoomServiceClient,
  CreateOptions,
} from 'livekit-server-sdk';
import { randomUUID as uuidv4 } from 'crypto';

@Injectable()
export class VideoCallsService {
  private roomService: RoomServiceClient;

  constructor(
    @InjectPinoLogger(VideoCallsService.name)
    private readonly logger: PinoLogger,
    private configService: ConfigService,
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

    const createOptions: CreateOptions = {
      name: roomName,
      emptyTimeout: 30,
      maxParticipants: 2,
    };

    try {
      await this.roomService.createRoom(createOptions);
      this.logger.info({
        msg: 'Video room created',
        roomName,
        userId,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown LiveKit error';
      this.logger.error({
        msg: 'Failed to create video room',
        roomName,
        userId,
        error: message,
      });
      throw error;
    }

    try {
      const token = await this.generateToken(userId, roomName, true);
      return { token, roomName };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown token generation error';
      this.logger.error({
        msg: 'Failed to generate token for created room',
        roomName,
        userId,
        error: message,
      });
      throw error;
    }
  }

  async joinRoom(
    userId: string,
    roomName: string,
  ): Promise<{ token: string; roomName: string }> {
    try {
      const token = await this.generateToken(userId, roomName, true);
      this.logger.info({
        msg: 'User joined video room',
        roomName,
        userId,
      });
      return { token, roomName };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown join error';
      this.logger.error({
        msg: 'Failed to join video room',
        roomName,
        userId,
        error: message,
      });
      throw error;
    }
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
