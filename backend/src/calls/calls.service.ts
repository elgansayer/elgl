import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class CallsService {
  constructor(private configService: ConfigService) {}

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
}
