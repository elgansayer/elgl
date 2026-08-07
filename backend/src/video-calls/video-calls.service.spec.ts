import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VideoCallsService } from './video-calls.service';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

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

// Mock uuid
let counter = 0;
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => `mock-uuid-${counter++}`),
}));

describe('VideoCallsService', () => {
  let service: VideoCallsService;

  beforeEach(async () => {
    mockCreateRoom.mockClear().mockResolvedValue({});
    mockAddGrant.mockClear();
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');
    counter = 0;

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
      ],
    }).compile();

    service = module.get<VideoCallsService>(VideoCallsService);
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

      expect(result).toEqual({
        token: 'mock-livekit-jwt',
        roomName: 'video_mock-uuid-0',
      });
    });

    it('should propagate errors from LiveKit createRoom', async () => {
      mockCreateRoom.mockRejectedValueOnce(
        new Error('LiveKit connection refused'),
      );

      await expect(service.createRoom('user-456')).rejects.toThrow(
        'LiveKit connection refused',
      );
    });

    it('should propagate errors from token generation', async () => {
      mockToJwt.mockRejectedValueOnce(new Error('JWT signing failed'));

      await expect(service.createRoom('user-789')).rejects.toThrow(
        'JWT signing failed',
      );
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

      expect(result).toEqual({
        token: 'mock-livekit-jwt',
        roomName: 'video-abc',
      });
    });

    it('should not call createRoom when joining', async () => {
      await service.joinRoom('user-1', 'existing-room');

      expect(mockCreateRoom).not.toHaveBeenCalled();
      expect(mockAddGrant).toHaveBeenCalledWith(
        expect.objectContaining({ room: 'existing-room' }),
      );
    });

    it('should propagate errors from token generation', async () => {
      mockToJwt.mockRejectedValueOnce(new Error('JWT signing failed'));

      await expect(
        service.joinRoom('user-999', 'some-room'),
      ).rejects.toThrow('JWT signing failed');
    });
  });
});