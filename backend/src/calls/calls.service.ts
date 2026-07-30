import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class CallsService {
  private livekitHost: string;

  constructor(private configService: ConfigService) {
    this.livekitHost =
      this.configService.get<string>('LIVEKIT_URL') || 'http://localhost:7880';
  }

  async initiateCall(
    callerId: string,
    calleeId: string,
    isVideo: boolean = true,
  ) {
    const roomName = `call_${uuidv4()}`;
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret =
      this.configService.get<string>('LIVEKIT_SECRET') || 'secret';

    // Generate a random 32‑byte key for end‑to‑end encryption
    const e2eeKey = crypto.randomBytes(32).toString('base64');
    // Embed the key and video flag in token metadata so the client can read it
    const metadata = JSON.stringify({ e2eeKey, isVideo });

    const generateToken = (identity: string): Promise<string> => {
      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        metadata,
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      return at.toJwt();
    };

    const [callerToken, calleeToken] = await Promise.all([
      generateToken(callerId),
      generateToken(calleeId),
    ]);

    return {
      room_name: roomName,
      caller_token: callerToken,
      callee_token: calleeToken,
      e2ee_key: e2eeKey,
      is_video: isVideo,
      call_id: uuidv4(),
    };
  }

  async createGroupCall(
    callerId: string,
    participantIds: string[],
    participantLimit: number,
  ) {
    if (!participantIds.includes(callerId)) {
      participantIds.unshift(callerId);
    }

    if (participantIds.length > participantLimit) {
      throw new BadRequestException(
        `Number of participants (${participantIds.length}) exceeds the limit (${participantLimit})`,
      );
    }

    const roomName = `group_${uuidv4()}`;
    const apiKey =
      this.configService.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret =
      this.configService.get<string>('LIVEKIT_SECRET') || 'secret';

    // Create the room with a maximum participant limit
    const roomService = new RoomServiceClient(
      this.livekitHost,
      apiKey,
      apiSecret,
    );
    await roomService.createRoom({
      name: roomName,
      maxParticipants: participantLimit,
    });

    const e2eeKey = crypto.randomBytes(32).toString('base64');
    const metadata = JSON.stringify({
      e2eeKey,
      isVideo: true,
      isGroup: true,
      participantLimit,
    });

    const generateToken = async (identity: string): Promise<string> => {
      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        metadata,
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      return await at.toJwt();
    };

    const tokens = await Promise.all(participantIds.map(generateToken));

    return {
      room_name: roomName,
      tokens,
      e2ee_key: e2eeKey,
      is_video: true,
      call_id: uuidv4(),
      participant_limit: participantLimit,
    };
  }
}
