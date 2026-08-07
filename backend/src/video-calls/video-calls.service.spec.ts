import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { VideoCallsService } from './video-calls.service';
import { StartVideoCallDto, ListActiveRoomsQueryDto } from './dto/video-call.dto';

jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: jest.fn(),
    toJwt: jest.fn().mockResolvedValue('mock_jwt_token'),
  })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: jest.fn().mockResolvedValue(undefined),
    deleteRoom: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('VideoCallsService', () => {
  let service: VideoCallsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                LIVEKIT_URL: 'http://localhost:7880',
                LIVEKIT_API_KEY: 'test_api_key',
                LIVEKIT_SECRET: 'test_secret',
              };
              return config[key] || null;
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

  describe('createRoom', () => {
    it('should create a video room and return token', async () => {
      const dto: StartVideoCallDto = {
        is_video: true,
        max_participants: 10,
      };
      const result = await service.createRoom('user1', dto);
      expect(result).toHaveProperty('token', 'mock_jwt_token');
      expect(result).toHaveProperty('room_name');
      expect(result.room_name).toMatch(/^video_/);
      expect(result.is_video).toBe(true);
    });

    it('should default to video and 2 participants when no DTO provided', async () => {
      const result = await service.createRoom('user1');
      expect(result.is_video).toBe(true);
      expect(result.room_name).toMatch(/^video_/);
    });
  });

  describe('joinRoom', () => {
    it('should generate a token for an existing room', async () => {
      const dto: StartVideoCallDto = {
        is_video: false,
        max_participants: 5,
      };
      const created = await service.createRoom('user1', dto);
      const result = await service.joinRoom('user2', created.room_name);
      expect(result).toHaveProperty('token', 'mock_jwt_token');
      expect(result.room_name).toBe(created.room_name);
      expect(result.is_video).toBe(false);
    });

    it('should throw NotFoundException for non-existent room', async () => {
      await expect(
        service.joinRoom('user1', 'nonexistent_room'),
      ).rejects.toThrow('Room not found');
    });
  });

  describe('endRoom', () => {
    it('should end a room created by the same user', async () => {
      const created = await service.createRoom('user1');
      const result = await service.endRoom('user1', created.room_name);
      expect(result.success).toBe(true);
      expect(result.room_name).toBe(created.room_name);
    });

    it('should throw ForbiddenException if non-creator ends room', async () => {
      const created = await service.createRoom('user1');
      await expect(
        service.endRoom('user2', created.room_name),
      ).rejects.toThrow('Only the room creator can end the room.');
    });

    it('should throw NotFoundException for non-existent room', async () => {
      await expect(
        service.endRoom('user1', 'nonexistent_room'),
      ).rejects.toThrow('Room not found');
    });
  });

  describe('listActiveRooms', () => {
    it('should list all active rooms', async () => {
      await service.createRoom('user1');
      await service.createRoom('user2', {
        is_video: true,
        max_participants: 20,
      });

      const query: ListActiveRoomsQueryDto = {};
      const rooms = await service.listActiveRooms(query);
      expect(rooms.length).toBe(2);
      expect(rooms[0]).toHaveProperty('room_name');
      expect(rooms[0]).toHaveProperty('creator_id');
      expect(rooms[0]).toHaveProperty('participant_count');
    });

    it('should filter by type classroom', async () => {
      await service.createRoom('user1');
      await service.createRoom('user2', {
        is_video: true,
        max_participants: 20,
      });

      const query: ListActiveRoomsQueryDto = { type: 'classroom' };
      const rooms = await service.listActiveRooms(query);
      expect(rooms.length).toBe(1);
    });

    it('should filter by type direct', async () => {
      await service.createRoom('user1');
      await service.createRoom('user2', {
        is_video: true,
        max_participants: 20,
      });

      const query: ListActiveRoomsQueryDto = { type: 'direct' };
      const rooms = await service.listActiveRooms(query);
      expect(rooms.length).toBe(1);
    });
  });

  describe('getActiveRoom', () => {
    it('should return room details with participants', async () => {
      const created = await service.createRoom('user1', {
        max_participants: 5,
      });
      await service.joinRoom('user2', created.room_name);
      const room = await service.getActiveRoom('user1', created.room_name);
      expect(room.room_name).toBe(created.room_name);
      expect(room.participant_count).toBe(2);
      expect(room.participants.length).toBe(2);
    });

    it('should throw NotFoundException for non-existent room', async () => {
      await expect(
        service.getActiveRoom('user1', 'nonexistent_room'),
      ).rejects.toThrow('Room not found');
    });
  });
});
