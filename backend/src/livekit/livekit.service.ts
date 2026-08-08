import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface LivekitTokenResponse {
  token: string;
  ice_servers: IceServer[];
  livekit_url: string;
}

@Injectable()
export class LivekitService {
  private roomService: RoomServiceClient;

  constructor(private configService: ConfigService) {
    this.roomService = new RoomServiceClient(
      this.configService.get<string>('LIVEKIT_URL') ?? 'http://localhost:7880',
      this.configService.get<string>('LIVEKIT_API_KEY'),
      this.configService.get<string>('LIVEKIT_SECRET'),
    );
  }

  async generateToken(
    roomName: string,
    participantIdentity: string,
    canPublish = true,
    canSubscribe = true,
  ): Promise<LivekitTokenResponse> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_SECRET');

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData: canPublish,
    });

    const token = await at.toJwt();
    const iceServers = this.buildIceServers();

    return {
      token,
      ice_servers: iceServers,
      livekit_url: this.configService.get<string>('LIVEKIT_URL') ?? 'ws://localhost:7880',
    };
  }

  private buildIceServers(): IceServer[] {
    const servers: IceServer[] = [];

    // STUN servers from config
    const stunServers = this.configService.get<string>('LIVEKIT_RTC_STUN_SERVERS');
    if (stunServers) {
      stunServers.split(',').forEach((url) => {
        const trimmed = url.trim();
        if (trimmed) {
          servers.push({ urls: trimmed });
        }
      });
    } else {
      // Default fallback STUN servers
      servers.push(
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      );
    }

    // TURN server from config
    const turnEnabled = this.configService.get<string>('LIVEKIT_TURN_ENABLED');
    if (turnEnabled === 'true') {
      const turnDomain = this.configService.get<string>('LIVEKIT_TURN_DOMAIN');
      const turnUsername = this.configService.get<string>('LIVEKIT_TURN_USERNAME');
      const turnPassword = this.configService.get<string>('LIVEKIT_TURN_PASSWORD');
      const turnTlsPort = this.configService.get<string>('LIVEKIT_TURN_TLS_PORT') ?? '5349';
      const turnUdpPort = this.configService.get<string>('LIVEKIT_TURN_UDP_PORT') ?? '3478';

      if (turnDomain) {
        const credentials = turnUsername && turnPassword
          ? { username: turnUsername, credential: turnPassword }
          : {};

        // TURN TLS
        servers.push({
          urls: `turns:${turnDomain}:${turnTlsPort}?transport=tcp`,
          ...credentials,
        });
        // TURN UDP
        servers.push({
          urls: `turn:${turnDomain}:${turnUdpPort}?transport=udp`,
          ...credentials,
        });
      }
    } else {
      // Fallback TURN configuration from dedicated env vars (for manual setup)
      const turnServerUrl = this.configService.get<string>('TURN_SERVER_URL');
      if (turnServerUrl) {
        servers.push({
          urls: turnServerUrl,
          username: this.configService.get<string>('TURN_USERNAME') ?? 'guest',
          credential: this.configService.get<string>('TURN_PASSWORD') ?? 'somepassword',
        });
      }
    }

    return servers;
  }
}