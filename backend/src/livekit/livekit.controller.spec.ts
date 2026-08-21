import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { AccessToken } from 'livekit-server-sdk';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

const mockToJwt = vi.fn().mockResolvedValue('mock-livekit-jwt');
const mockAddGrant = vi.fn();

vi.mock('livekit-server-sdk', () => ({
  AccessToken: vi.fn().mockImplementation(function () {
    return {
      addGrant: mockAddGrant,
      toJwt: mockToJwt,
    };
  }),
}));

// Mock the auth guard so we can focus on the controller logic
const mockAuthGuard = {
  canActivate: vi.fn().mockReturnValue(true),
};

describe('LivekitController', () => {
  let controller: LivekitController;

  beforeEach(async () => {
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');
    mockAddGrant.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitController],
      providers: [
        LivekitService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              switch (key) {
                case 'LIVEKIT_API_KEY':
                  return 'test-api-key';
                case 'LIVEKIT_SECRET':
                  return 'test-secret';
                case 'LIVEKIT_RTC_STUN_SERVERS':
                  return 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
                case 'LIVEKIT_TURN_ENABLED':
                  return 'true';
                case 'LIVEKIT_TURN_DOMAIN':
                  return 'turn.example.com';
                case 'LIVEKIT_TURN_UDP_PORT':
                  return '3478';
                case 'LIVEKIT_TURN_TLS_PORT':
                  return '5349';
                case 'LIVEKIT_TURN_USERNAME':
                  return 'testuser';
                case 'LIVEKIT_TURN_PASSWORD':
                  return 'testpass';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<LivekitController>(LivekitController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getToken', () => {
    it('should return a token and ICE servers', async () => {
      const result = await controller.getToken({
        room_name: 'test-room',
        participant_identity: 'user-123',
      });

      expect(AccessToken).toHaveBeenCalledWith(
        'test-api-key',
        'test-secret',
        expect.objectContaining({
          identity: 'user-123',
          ttl: '1h',
        }),
      );
      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'test-room',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      expect(mockToJwt).toHaveBeenCalled();
      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.iceServers).toBeDefined();

      // Should include STUN servers
      expect(result.iceServers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ urls: 'stun:stun.l.google.com:19302' }),
          expect.objectContaining({ urls: 'stun:stun1.l.google.com:19302' }),
        ]),
      );

      // Should include TURN UDP, TCP, and TLS servers
      const turnUrls = result.iceServers.map((s) =>
        typeof s.urls === 'string' ? s.urls : s.urls[0],
      );
      expect(turnUrls).toEqual(
        expect.arrayContaining([
          'turn:turn.example.com:3478?transport=udp',
          'turn:turn.example.com:3478?transport=tcp',
          'turns:turn.example.com:5349?transport=tcp',
        ]),
      );
    });

    it('should return empty ICE servers when TURN is disabled and no STUN configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [LivekitController],
        providers: [
          LivekitService,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) => {
                switch (key) {
                  case 'LIVEKIT_API_KEY':
                    return 'test-api-key';
                  case 'LIVEKIT_SECRET':
                    return 'test-secret';
                  case 'LIVEKIT_RTC_STUN_SERVERS':
                    return '';
                  case 'LIVEKIT_TURN_ENABLED':
                    return 'false';
                  default:
                    return null;
                }
              }),
            },
          },
        ],
      })
        .overrideGuard(SupabaseAuthGuard)
        .useValue(mockAuthGuard)
        .compile();

      const ctrl = module.get<LivekitController>(LivekitController);
      const result = await ctrl.getToken({
        room_name: 'bare-room',
        participant_identity: 'user-2',
      });

      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.iceServers).toEqual([]);
    });

    it('should propagate token generation errors', async () => {
      mockToJwt.mockRejectedValueOnce(new Error('JWT signing failed'));

      await expect(
        controller.getToken({
          room_name: 'fail-room',
          participant_identity: 'user-3',
        }),
      ).rejects.toThrow('JWT signing failed');
    });
  });
});
