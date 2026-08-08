import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsService } from './video-calls-service';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { MetricsService } from '../metrics/metrics.service';

const mockCreateRoom = jest.fn();
const mockAddGrant = jest.fn();
const mockToJwt = jest.fn();

jest.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: jest.fn().mockImplementation(() => {
      return {
        createRoom: mockCreateRoom,
      };
    }),
    AccessToken: jest.fn().mockImplementation(() => {
      return {
        addGrant: mockAddGrant,
        toJwt: mockToJwt,
      };
    }),
  };
});

let counter = 0;
jest.mock('crypto', () => ({
  randomUUID: () => `mock-uuid-${counter++}`,
}));

describe('VideoCallsService', () => {
  let service: VideoCallsService;
  let degradationService: VideoCallsDegradationService;
  let metrics: MetricsService;

  const mockMetricsService = {
    recordVideoClassroomCreated: jest.fn(),
    recordVideoClassroomCreationFailed: jest.fn(),
    recordVideoClassroomJoined: jest.fn(),
    recordVideoClassroomJoinFailed: jest.fn(),
    recordVideoClassroomTokenGenerationDuration: jest.fn(),
  };

  const mockDegradationService = {
    executeWithBreaker: jest.fn().mockImplementation(
      async (_service: string, operation: () => Promise<unknown>, _fallback: () => unknown, marker: any) => {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should create a room on LiveKit and return a token and room name', async () => {
      const result = await service.createRoom('user-123');

      expect(mockCreateRoom).toHaveBeenCalledWith({
        name: 'video_mock-uuid-0',
        emptyTimeout: 30,
        maxParticipants: 2,
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
        room: 'video_mock-uuid-0',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
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
        async (_service: string, _operation: () => Promise<unknown>, fallback: () => unknown, marker: any) => {
          marker.degraded = true;
          marker.reason = 'Service livekit failed: LiveKit connection refused';
          marker.fallbackSource = 'standalone';
          try {
             await _operation();
          } catch(e) {}
          return fallback();
        },
      );

      const result = await service.createRoom('user-456');

      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.roomName).toBe('video_mock-uuid-0');
      expect(result.degraded).toBe(true);
      expect(result.degradationReason).toContain('LiveKit connection refused');
      expect(metrics.recordVideoClassroomCreationFailed).toHaveBeenCalledWith('Error');
    });

    it('should track token generation failures', async () => {
      mockToJwt.mockRejectedValueOnce(new Error('JWT signing failed'));
      // allow operation to fail
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (_service: string, operation: () => Promise<unknown>) => {
           return await operation();
        },
      );

      await expect(service.createRoom('user-789')).rejects.toThrow(
        'JWT signing failed',
      );

      expect(metrics.recordVideoClassroomCreationFailed).toHaveBeenCalledWith('Error');
    });
  });

  describe('joinRoom', () => {
    it('should generate a token for an existing room', async () => {
      const result = await service.joinRoom('user-456', 'video-abc');

      expect(AccessToken).toHaveBeenCalledWith(
        'test-api-key',
        'test-secret',
        expect.objectContaining({
          identity: 'user-456',
          ttl: '1h',
        }),
      );

      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'video-abc',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
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
      await service.joinRoom('user-1', 'existing-room');

      expect(mockCreateRoom).not.toHaveBeenCalled();
      expect(mockAddGrant).toHaveBeenCalledWith(
        expect.objectContaining({ room: 'existing-room' }),
      );
    });

    it('should use cached token as fallback when operation fails', async () => {
      mockDegradationService.getCachedToken.mockReturnValueOnce('cached-token');
      mockDegradationService.executeWithBreaker.mockImplementationOnce(
        async (_service: string, operation: () => Promise<unknown>, fallback: () => unknown, marker: any) => {
          marker.degraded = true;
          marker.reason = 'Service livekit failed: timeout';
          marker.fallbackSource = 'cache';
          try {
             await operation();
          } catch(e) {}
          return fallback();
        },
      );
      mockToJwt.mockRejectedValueOnce(new Error('timeout'));

      const result = await service.joinRoom('user-999', 'some-room');

      expect(result.token).toBe('cached-token');
      expect(result.roomName).toBe('some-room');
      expect(result.degraded).toBe(true);
      expect(metrics.recordVideoClassroomJoinFailed).toHaveBeenCalledWith('Error');
    });
  });
});
