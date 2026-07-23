import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VideoCallsService {
  private roomService: RoomServiceClient;

  constructor(private configService: ConfigService) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') as string,
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
    );
  }

  async createRoom(userId: string, _remoteUserId: string) {
    const roomName = `video_${uuidv4()}`;

    await this.roomService.createRoom({
      name: roomName,
      emptyTimeout: 30,
      maxParticipants: 2,
    });

    const token = this.generateToken(userId, roomName, true);

    return { token, roomName };
  }

  async joinRoom(userId: string, roomName: string) {
    const token = this.generateToken(userId, roomName, true);
    return { token, roomName };
  }

  private generateToken(
    userId: string,
    roomName: string,
    canPublish: boolean,
  ): string {
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

    return at.toJwt();
  }
}
