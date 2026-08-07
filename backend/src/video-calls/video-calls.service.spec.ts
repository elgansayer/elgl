import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VideoCallsService } from './video-calls.service';
import { RetryService } from '../common/retry/retry.service';

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

const MOCK_LOGGER = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as any;

describe('VideoCallsService', () => {
  let service: VideoCallsService;
  let retryService: RetryService;

  beforeEach(async () => {
    mockCreateRoom.mockClear().mockResolvedValue({});
    mockAddGrant.mockClear();
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');

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
          provide: RetryService,
          useFactory: () => new RetryService(MOCK_LOGGER),
        },
      ],
    }).compile();

    service = module.get<VideoCallsService>(VideoCallsService);
    retryService = module.get<RetryService>(RetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should create a room and return token and roomName', async () => {
      const result = await service.createRoom('user-123');

      expect(result).toHaveProperty('token', 'mock-livekit-jwt');
      expect(result).toHaveProperty('roomName');
      expect(result.roomName).toMatch(/^video_/);
      expect(mockCreateRoom).toHaveBeenCalledTimes(1);
      expect(mockCreateRoom).toHaveBeenCalledWith({
        name: result.roomName,
        emptyTimeout: 30,
        maxParticipants: 2,
      });
      expect(mockToJwt).toHaveBeenCalledTimes(1);
    });

    it('should retry creating the room on HTTP 429 errors', async () => {
      let callCount = 0;
      mockCreateRoom.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          const err = Object.assign(new Error('Too Many Requests'), {
            status: 429,
            response: { status: 429, headers: {} },
          });
          throw err;
        }
        return {};
      });

      const result = await service.createRoom('user-123');
      expect(callCount).toBe(3);
      expect(result.token).toBe('mock-livekit-jwt');
      expect(result.roomName).toMatch(/^video_/);
    });

    it('should throw after exhausting all retry attempts', async () => {
      const rateLimitError = Object.assign(new Error('Too Many Requests'), {
        status: 429,
        response: { status: 429, headers: {} },
      });
      mockCreateRoom.mockRejectedValue(rateLimitError);

      await expect(service.createRoom('user-123')).rejects.toThrow(
        'Too Many Requests',
      );
      // 1 original + 3 retries = 4 calls
      expect(mockCreateRoom).toHaveBeenCalledTimes(4);
    }, 15000);

    it('should NOT retry on non-429 errors', async () => {
      mockCreateRoom.mockRejectedValue(new Error('Network error'));

      await expect(service.createRoom('user-123')).rejects.toThrow(
        'Network error',
      );
      expect(mockCreateRoom).toHaveBeenCalledTimes(1);
    });
  });

  describe('joinRoom', () => {
    it('should generate a token for an existing room', async () => {
      const result = await service.joinRoom('user-456', 'video_existing-room');

      expect(result).toEqual({
        token: 'mock-livekit-jwt',
        roomName: 'video_existing-room',
      });
      expect(mockCreateRoom).not.toHaveBeenCalled();
      expect(mockToJwt).toHaveBeenCalledTimes(1);
    });
  });
});