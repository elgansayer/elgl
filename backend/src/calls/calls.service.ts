import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CallsService {
  constructor(private configService: ConfigService) {}

  async initiateCall(callerId: string, calleeId: string) {
    const roomName = `call_${uuidv4()}`;
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret =
      this.configService.get<string>('LIVEKIT_SECRET') || 'secret';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: callerId,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return {
      room_name: roomName,
      token: await at.toJwt(),
    };
  }
}
