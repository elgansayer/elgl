import { LivekitService } from '../livekit/livekit.service';
import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsService } from './video-calls.service';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { VideoCallsEncryptionService } from './video-calls-encryption.service';
import { MetricsService } from '../metrics/metrics.service';

const mockCreateRoom = vi.fn();
const mockAddGrant = vi.fn();
const mockToJwt = vi.fn();

vi.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: vi.fn().mockImplementation(function () {
      return {
        createRoom: mockCreateRoom,
      };
    }),
    AccessToken: vi.fn().mockImplementation(function () {
      return {
        addGrant: mockAddGrant,
        toJwt: mockToJwt,
      };
    }),
  };
});

let counter = 0;
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`,
  };
});

describe('VideoCallsService', () => {
  let service: VideoCallsService;
  let metrics: MetricsService;

  const callerId = '11111111-1111-4111-8111-111111111111';
  const remoteUserId = '22222222-2222-4222-8222-222222222222';
  const expectedRoomName = 'video_00000000-0000-4000-8000-000000000000';

  const mockMetricsService = {
    recordVideoClassroomCreated: vi.fn(),
    recordVideoClassroomCreationFailed: vi.fn(),
    recordVideoClassroomJoined: vi.fn(),
    recordVideoClassroomJoinFailed: vi.fn(),
    recordVideoClassroomTokenGenerationDuration: vi.fn(),
  };

  const mockDegradationService = {
    executeWithBreaker: vi
      .fn()
      .mockImplementation(
        async (
          _service: string,
          operation: () => Promise<unknown>,
          _fallback: () => unknown,
          marker: any,
        ) => {
          try {
            return await operation();
          } catch (error) {
            marker.degraded = true;
            marker.reason = `Service ${_service} failed: ${(error as Error).message}`;
            marker.fallbackSource = 'standalone';
            return _fallback();
          }
        },
      ),
    cacheToken: vi.fn(),
    getCachedToken: vi.fn().mockReturnValue(null),
    recordDegradationEvent: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  };

  const mockEncryptionService = {
    createSession: vi.fn().mockResolvedValue('room-e2ee-key'),
    getKeyForParticipant: vi.fn().mockResolvedValue('room-e2ee-key'),
  };

  beforeEach(async () => {
    mockCreateRoom.mockClear().mockResolvedValue({});
    mockAddGrant.mockClear();
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');
    counter = 0;
    mockDegradationService.executeWithBreaker.mockClear();
    mockDegradationService.cacheToken.mockClear();
    mockDegradationService.getCachedToken.mockClear().mockReturnValue(null);
    mockDegradationService.recordDegradationEvent.mockClear();
    mockEncryptionService.createSession
      .mockClear()
      .mockResolvedValue('room-e2ee-key');
    mockEncryptionService.getKeyForParticipant
      .mockClear()
      .mockResolvedValue('room-e2ee-key');

    Object.values(mockMetricsService).forEach((fn) => fn.mockClear());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'LIVEKIT_URL') return 'https://test.livekit.cloud';
              if (key === 'LIVEKIT_API_KEY') return 'test-api-key';
              if (key === 'LIVEKIT_SECRET') return 'test-secret';
              return null;
            }),
          },
        },
        {
          provide: VideoCallsDegradationService,
          useValue: mockDegradationService,
        },
        {
          provide: VideoCallsEncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: LivekitService,
          useValue: { buildIceServers: vi.fn().mockReturnValue([]) },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<VideoCallsService>(VideoCallsService);
    metrics = module.get(MetricsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should create a two-person room and return token plus E2EE key', async () => {
      const result = await service.createRoom(callerId, remoteUserId);

      expect(mockCreateRoom).toHaveBeenCalledWith({
        name: expectedRoomName,
        emptyTimeout: 30,
        maxParticipants: 2,
      });
      expect(AccessToken).toHaveBeenCalledWith(
        'test-api-key',
        'test-secret',
        expect.objectContaining({ identity: callerId, ttl: '1h' }),
      );
      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: expectedRoomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      expect(mockEncryptionService.createSession).toHaveBeenCalledWith(
        expectedRoomName,
        callerId,
        remoteUserId,
      );
      expect(result).toEqual(
        expect.objectContaining({
          token: 'mock-livekit-jwt',
          roomName: expectedRoomName,
          e2eeKey: 'room-e2ee-key',
          degraded: false,
        }),
      );
      expect(metrics.recordVideoClassroomCreated).toHaveBeenCalled();
    });

    it('should cache the caller token after successful room creation', async () => {
      await service.createRoom(callerId, remoteUserId);

      expect(mockDegradationService.cacheToken).toHaveBeenCalledWith(
        expectedRoomName,
        callerId,
        'mock-livekit-jwt',
      );
    });

    it('should fail closed when the E2EE key broker cannot create a session', async () => {
      mockEncryptionService.createSession.mockRejectedValueOnce(
        new Error('key broker unavailable'),
      );

      await expect(service.createRoom(callerId, remoteUserId)).rejects.toThrow(
        'key broker unavailable',
      );
    });

    it('should preserve E2EE when LiveKit control-plane creation degrades', async () => {
      mockCreateRoom.mockRejectedValueOnce(
        new Error('LiveKit connection refused'),
      );
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (
          _service: string,
          operation: () => Promise<unknown>,
          fallback: () => unknown,
          marker: any,
        ) => {
          marker.degraded = true;
          marker.reason = 'Service livekit failed: LiveKit connection refused';
          marker.fallbackSource = 'standalone';
          try {
            await operation();
          } catch {
            // Expected: exercise fallback token generation.
          }
          return fallback();
        },
      );

      const result = await service.createRoom(callerId, remoteUserId);

      expect(result.e2eeKey).toBe('room-e2ee-key');
      expect(result.degraded).toBe(true);
      expect(result.degradationReason).toContain('LiveKit connection refused');
    });

    it('should track token generation failures', async () => {
      mockToJwt.mockRejectedValueOnce(new Error('JWT signing failed'));
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (_service: string, operation: () => Promise<unknown>) =>
          operation(),
      );

      await expect(service.createRoom(callerId, remoteUserId)).rejects.toThrow(
        'JWT signing failed',
      );
      expect(metrics.recordVideoClassroomCreationFailed).toHaveBeenCalledWith(
        'Error',
      );
      expect(mockEncryptionService.createSession).not.toHaveBeenCalled();
    });
  });

  describe('joinRoom', () => {
    const roomName = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';

    it('should authorize the participant before minting a LiveKit token', async () => {
      const result = await service.joinRoom(remoteUserId, roomName);

      expect(mockEncryptionService.getKeyForParticipant).toHaveBeenCalledWith(
        roomName,
        remoteUserId,
      );
      expect(mockAddGrant).toHaveBeenCalledWith(
        expect.objectContaining({ room: roomName }),
      );
      expect(result.e2eeKey).toBe('room-e2ee-key');
      expect(result.token).toBe('mock-livekit-jwt');
      expect(metrics.recordVideoClassroomJoined).toHaveBeenCalled();
    });

    it('should not mint a token when encrypted-session authorization fails', async () => {
      mockEncryptionService.getKeyForParticipant.mockRejectedValueOnce(
        new Error('Call is unavailable'),
      );

      await expect(service.joinRoom('intruder', roomName)).rejects.toThrow(
        'Call is unavailable',
      );
      expect(AccessToken).not.toHaveBeenCalled();
    });

    it('should use a cached token fallback without dropping E2EE', async () => {
      mockDegradationService.getCachedToken.mockReturnValueOnce('cached-token');
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (
          _service: string,
          operation: () => Promise<unknown>,
          fallback: () => unknown,
          marker: any,
        ) => {
          marker.degraded = true;
          marker.reason = 'Service livekit failed: timeout';
          marker.fallbackSource = 'cache';
          try {
            await operation();
          } catch {
            // Expected: exercise cached-token fallback.
          }
          return fallback();
        },
      );
      mockToJwt.mockRejectedValueOnce(new Error('timeout'));

      const result = await service.joinRoom(remoteUserId, roomName);

      expect(result.token).toBe('cached-token');
      expect(result.e2eeKey).toBe('room-e2ee-key');
      expect(result.degraded).toBe(true);
      expect(metrics.recordVideoClassroomJoinFailed).toHaveBeenCalledWith(
        'Error',
      );
    });
  });
});
