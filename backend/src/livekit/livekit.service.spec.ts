import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LivekitService } from './livekit.service';

const mockConfigGet = jest.fn();

describe('LivekitService', () => {
  let service: LivekitService;

  beforeEach(async () => {
    mockConfigGet.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivekitService,
        {
          provide: ConfigService,
          useValue: { get: mockConfigGet },
        },
      ],
    }).compile();

    service = module.get<LivekitService>(LivekitService);
  });

  describe('buildIceServers', () => {
    it('returns Google STUN fallback when no STUN configured', () => {
      mockConfigGet.mockReturnValue(undefined);
      const servers = service.buildIceServers();
      expect(servers).toEqual([
        {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        },
      ]);
    });

    it('uses LIVEKIT_RTC_STUN_SERVERS when configured', () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === 'LIVEKIT_RTC_STUN_SERVERS')
          return 'stun:a.com:3478, stun:b.com:3478';
        return undefined;
      });
      const servers = service.buildIceServers();
      expect(servers[0]).toEqual({
        urls: ['stun:a.com:3478', 'stun:b.com:3478'],
      });
    });

    it('adds TURN server when LIVEKIT_TURN_ENABLED=true', () => {
      mockConfigGet.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          LIVEKIT_RTC_STUN_SERVERS: 'stun:stun.l.google.com:19302',
          LIVEKIT_TURN_ENABLED: 'true',
          LIVEKIT_TURN_DOMAIN: 'turn.corp.com',
          LIVEKIT_TURN_UDP_PORT: '3478',
          LIVEKIT_TURN_TLS_PORT: '5349',
        };
        return map[key];
      });
      const servers = service.buildIceServers();
      expect(servers).toHaveLength(2);
      expect(servers[1]).toEqual({
        urls: [
          'turn:turn.corp.com:3478?transport=udp',
          'turns:turn.corp.com:5349?transport=tcp',
        ],
        username: 'livekit',
        credential: 'livekit',
      });
    });

    it('does not add TURN when disabled', () => {
      mockConfigGet.mockImplementation((key: string) => {
        const map: Record<string, string> = {
          LIVEKIT_RTC_STUN_SERVERS: 'stun:stun.l.google.com:19302',
          LIVEKIT_TURN_ENABLED: 'false',
          LIVEKIT_TURN_DOMAIN: 'turn.corp.com',
        };
        return map[key];
      });
      const servers = service.buildIceServers();
      expect(servers).toHaveLength(1);
    });
  });

  describe('generateToken', () => {
    it('returns a token string and ICE server list', async () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === 'LIVEKIT_API_KEY') return 'api-key';
        if (key === 'LIVEKIT_SECRET') return 'secret-key';
        if (key === 'LIVEKIT_RTC_STUN_SERVERS')
          return 'stun:stun.custom.com:3478';
        return undefined;
      });

      const result = await service.generateToken('room1', 'user1');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.ice_servers).toEqual([
        { urls: 'stun:stun.custom.com:3478' },
      ]);
    });
  });
});