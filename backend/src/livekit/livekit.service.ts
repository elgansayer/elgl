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
  ice_servers: IceServer[];
}

@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LIVEKIT_API_KEY') ?? 'devkey';
    this.secretKey =
      this.configService.get<string>('LIVEKIT_SECRET') ?? 'secret';
  }

  /**
   * Issue a LiveKit access token for {@link roomName} scoped to
   * {@link participantIdentity}, bundled with the ICE server
   * configuration the client should use for NAT traversal.
   */
  generateToken(
    roomName: string,
    participantIdentity: string,
    canPublish: boolean = true,
    canSubscribe: boolean = true,
  ): Promise<TokenResponse> {
    const at = new AccessToken(this.apiKey, this.secretKey, {
      identity: participantIdentity,
      ttl: '24h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
    });

    return at.toJwt().then((token) => ({
      token,
      ice_servers: this.buildIceServers(),
    }));
  }

  /**
   * Build the list of ICE servers (STUN/TURN) from environment variables.
   *
   * Corporate / strict NAT networks need their own TURN servers
   * provisioned with long-lived credentials.  At minimum a public STUN
   * server is always returned.
   *
   * Uses LIVEKIT_RTC_STUN_SERVERS (comma-separated list set by the
   * LiveKit SFU config) and LIVEKIT_TURN_* variables for TURN relay.
   */
  buildIceServers(): IceServer[] {
    const servers: IceServer[] = [];

    // STUN servers
    const stunServers = this.configService.get<string>(
      'LIVEKIT_RTC_STUN_SERVERS',
    );
    if (stunServers) {
      const urls = stunServers
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      servers.push({ urls: urls.length === 1 ? urls[0] : urls });
    } else {
      servers.push({
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      });
    }

    // TURN server
    const turnEnabled =
      this.configService.get<string>('LIVEKIT_TURN_ENABLED') === 'true';
    const turnDomain = this.configService.get<string>('LIVEKIT_TURN_DOMAIN');
    const turnUdpPort = this.configService.get<string>('LIVEKIT_TURN_UDP_PORT');
    const turnTlsPort = this.configService.get<string>('LIVEKIT_TURN_TLS_PORT');

    if (turnEnabled && turnDomain) {
      const turnUrls: string[] = [];
      if (turnUdpPort) {
        turnUrls.push(`turn:${turnDomain}:${turnUdpPort}?transport=udp`);
      }
      if (turnTlsPort) {
        turnUrls.push(`turns:${turnDomain}:${turnTlsPort}?transport=tcp`);
      }

      if (turnUrls.length > 0) {
        servers.push({
          urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
          username: 'livekit',
          credential: 'livekit',
        });
      }
    }

    return servers;
  }
}