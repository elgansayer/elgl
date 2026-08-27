import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TokenResponse {
  token: string;
  iceServers: IceServer[];
}

@Injectable()
export class LivekitService {
  constructor(private configService: ConfigService) {}

  /** Generate a LiveKit access token for the given user and room. */
  async generateToken(
    userId: string,
    roomName: string,
  ): Promise<TokenResponse> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_SECRET');

    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (!apiKey || !apiSecret) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_SECRET must be configured');
    }

    if (env === 'production') {
      if (
        apiKey === 'test-livekit-api-key' ||
        apiKey === 'dev_livekit_key_test_value_123' ||
        apiSecret === 'test-livekit-secret' ||
        apiSecret === 'dev_livekit_secret_test_value_123'
      ) {
        throw new Error(
          'LIVEKIT_API_KEY and LIVEKIT_SECRET must be securely configured in production',
        );
      }
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return {
      token,
      iceServers: this.buildIceServers(),
    };
  }

  /** Build the list of ICE servers (STUN and TURN) from environment configuration. */
  buildIceServers(): IceServer[] {
    const iceServers: IceServer[] = [];

    // STUN servers from comma-separated env var
    const stunServers =
      this.configService.get<string>('LIVEKIT_RTC_STUN_SERVERS') || '';
    if (stunServers.trim()) {
      for (const url of stunServers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        iceServers.push({ urls: url });
      }
    }

    // TURN server configuration
    const turnEnabled =
      this.configService.get<string>('LIVEKIT_TURN_ENABLED') === 'true';
    if (turnEnabled) {
      const turnDomain = this.configService.get<string>('LIVEKIT_TURN_DOMAIN');
      const turnUdpPort =
        this.configService.get<string>('LIVEKIT_TURN_UDP_PORT') || '3478';
      const turnTlsPort =
        this.configService.get<string>('LIVEKIT_TURN_TLS_PORT') || '5349';
      const turnUsername = this.configService.get<string>(
        'LIVEKIT_TURN_USERNAME',
      );
      const turnPassword = this.configService.get<string>(
        'LIVEKIT_TURN_PASSWORD',
      );

      const env = this.configService.get<string>('NODE_ENV') || 'development';

      if (!turnDomain || !turnUsername || !turnPassword) {
        throw new Error(
          'LIVEKIT_TURN_DOMAIN, LIVEKIT_TURN_USERNAME, and LIVEKIT_TURN_PASSWORD must be configured when LIVEKIT_TURN_ENABLED is true',
        );
      }

      if (env === 'production') {
        if (
          turnDomain === 'turn.example.com' ||
          turnUsername === 'guest' ||
          turnPassword === 'somepassword'
        ) {
          throw new Error(
            'LIVEKIT_TURN_DOMAIN, LIVEKIT_TURN_USERNAME, and LIVEKIT_TURN_PASSWORD must be securely configured in production',
          );
        }
      }

      // UDP TURN
      iceServers.push({
        urls: `turn:${turnDomain}:${turnUdpPort}?transport=udp`,
        username: turnUsername,
        credential: turnPassword,
      });

      // TCP TURN
      iceServers.push({
        urls: `turn:${turnDomain}:${turnUdpPort}?transport=tcp`,
        username: turnUsername,
        credential: turnPassword,
      });

      // TLS TURN (TURNS)
      iceServers.push({
        urls: `turns:${turnDomain}:${turnTlsPort}?transport=tcp`,
        username: turnUsername,
        credential: turnPassword,
      });
    }

    return iceServers;
  }
}
