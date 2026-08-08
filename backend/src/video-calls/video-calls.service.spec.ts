import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsService } from './video-calls.service';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { MetricsService } from '../metrics/metrics.service';

const mockCreateRoom = jest.fn().mockResolvedValue({});
const mockAddGrant = jest.fn();
const mockToJwt = jest.fn().mockResolvedValue('mock-livekit-jwt');

jest.mock('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: mockCreateRoom,
  })),
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: mockAddGrant,
    toJwt: mockToJwt,
  })),
}));

let counter = 0;
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => `mock-uuid-${counter++}`),
}));

const mockMetricsService = {
  recordVideoClassroomCreated: jest.fn(),
  recordVideoClassroomCreationFailed: jest.fn(),
  recordVideoClassroomJoined: jest.fn(),
  recordVideoClassroomJoinFailed: jest.fn(),
  recordVideoClassroomTokenGenerationDuration: jest.fn(),
};

describe('VideoCallsService', () => {
  let service: VideoCallsService;
  let degradationService: VideoCallsDegradationService;
  let metrics: typeof mockMetricsService;

  const mockDegradationService = {
    executeWithBreaker: jest.fn(
      async (_service: string, operation: () => Promise<unknown>, _fallback: () => unknown, marker: any) => {
        try {
          const result = await operation();
          return result;
        } catch {
          marker.degraded = true;
          marker.reason = 'Service livekit failed';
          marker.fallbackSource = 'standalone';
          return _fallback();
        }
      },
    ),
    cacheToken: jest.fn(),
    getCachedToken: jest.fn().mockReturnValue(null),
    recordDegradationEvent: jest.fn().mockResolvedValue(undefined),
    isAvailable: jest.fn().mockReturnValue(true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
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

    // Reset metric mocks
    Object.values(mockMetricsService).forEach((fn) => fn.mockClear());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                LIVEKIT_URL: 'http://localhost:7880',
                LIVEKIT_API_KEY: 'mock-key',
                LIVEKIT_API_SECRET: 'mock-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: VideoCallsDegradationService,
          useValue: mockDegradationService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<VideoCallsService>(VideoCallsService);
    degradationService = module.get<VideoCallsDegradationService>(
      VideoCallsDegradationService,
    );
    metrics = module.get(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRoom', () => {
    it('should create a room and return token + room name', async () => {
      const result = await service.createRoom('user-123');

      expect(mockCreateRoom).toHaveBeenCalledWith({
        name: 'video_mock-uuid-0',
        emptyTimeout: 30,
        maxParticipants: 2,
      });

      expect(AccessToken).toHaveBeenCalledWith('mock-key', 'mock-secret', {
        identity: 'user-123',
      });

      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'video_mock-uuid-0',
        canPublish: true,
      });

      expect(mockToJwt).toHaveBeenCalled();

      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.roomName).toBe('video_mock-uuid-0');
      expect(result.degraded).toBeFalsy();

      expect(metrics.recordVideoClassroomCreated).toHaveBeenCalled();
      expect(metrics.recordVideoClassroomTokenGenerationDuration).toHaveBeenCalledWith(
        'create',
        expect.any(Number),
      );
    });

    it('should cache token after successful room creation', async () => {
      await service.createRoom('user-123');

      expect(mockDegradationService.cacheToken).toHaveBeenCalledWith(
        'video_mock-uuid-0',
        'user-123',
        'mock-livekit-jwt',
      );
    });

    it('should fallback when LiveKit createRoom fails', async () => {
      mockCreateRoom.mockRejectedValueOnce(
        new Error('LiveKit connection refused'),
      );
      // Reset the mock impl to let the real degradation flow work
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (_service: string, operation: () => Promise<unknown>, fallback: () => unknown, marker: any) => {
          try {
            await operation();
          } catch (e) {
            marker.degraded = true;
            marker.reason = 'Service livekit failed: LiveKit connection refused';
            marker.fallbackSource = 'standalone';
            return fallback();
          }
        },
      );

      const result = await service.createRoom('user-456');

      expect(metrics.recordVideoClassroomCreationFailed).toHaveBeenCalledWith('Error');
      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.roomName).toBe('video_mock-uuid-0');
      expect(result.degraded).toBe(true);
      expect(result.degradationReason).toContain('LiveKit connection refused');
    });

    it('should propagate errors from token generation and record failure metric', async () => {
      mockToJwt.mockRejectedValue(new Error('JWT signing failed'));

      await expect(service.createRoom('user-789')).rejects.toThrow(
        'JWT signing failed',
      );

      expect(metrics.recordVideoClassroomCreationFailed).toHaveBeenCalledWith('Error');
    });
  });

  describe('joinRoom', () => {
    it('should return a token for an existing room without calling createRoom', async () => {
      const result = await service.joinRoom('user-abc', 'video-abc');

      expect(AccessToken).toHaveBeenCalledWith('mock-key', 'mock-secret', {
        identity: 'user-abc',
      });

      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'video-abc',
        canPublish: true,
      });

      expect(mockToJwt).toHaveBeenCalled();

      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.roomName).toBe('video-abc');
      expect(result.degraded).toBeFalsy();

      expect(metrics.recordVideoClassroomJoined).toHaveBeenCalled();
      expect(metrics.recordVideoClassroomTokenGenerationDuration).toHaveBeenCalledWith(
        'join',
        expect.any(Number),
      );
    });

    it('should not call createRoom when joining', async () => {
      await service.joinRoom('user-xyz', 'existing-room');

      expect(mockCreateRoom).not.toHaveBeenCalled();
    });

    it('should use cached token as fallback when operation fails', async () => {
      mockDegradationService.getCachedToken.mockReturnValueOnce('cached-token');
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (_service: string, operation: () => Promise<unknown>, fallback: () => unknown, marker: any) => {
          try {
            await operation();
          } catch (e) {
            marker.degraded = true;
            marker.reason = 'Service livekit failed: timeout';
            marker.fallbackSource = 'cache';
            return fallback();
          }
        },
      );
      mockToJwt.mockRejectedValueOnce(new Error('timeout'));

      const result = await service.joinRoom('user-999', 'some-room');

      expect(metrics.recordVideoClassroomJoinFailed).toHaveBeenCalledWith('Error');
      expect(result.token).toBe('cached-token');
      expect(result.roomName).toBe('some-room');
      expect(result.degraded).toBe(true);
    });
  });
});
