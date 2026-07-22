import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AudioRoomsService } from './audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
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

describe('AudioRoomsService', () => {
  let service: AudioRoomsService;
  let usersService: UsersService;
  let centrifugoService: CentrifugoService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockCreateRoom.mockClear().mockResolvedValue({});
    mockAddGrant.mockClear();
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioRoomsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'LIVEKIT_URL') return 'https://test.livekit.cloud';
              if (key === 'LIVEKIT_API_KEY') return 'test-key';
              if (key === 'LIVEKIT_SECRET')
                return 'secret-secret-secret-secret-secret';
              return null;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              id: 'host-1',
              display_name: 'Host User',
              avatar_url: 'avatar.png',
            }),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            publish: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AudioRoomsService>(AudioRoomsService);
    usersService = module.get<UsersService>(UsersService);
    centrifugoService = module.get<CentrifugoService>(CentrifugoService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise LiveKit RoomServiceClient and log warning if construction throws', () => {
      (RoomServiceClient as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('SDK init failure');
      });
      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});

      service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not init LiveKit RoomServiceClient (SDK init failure). Will fall back to local/mock.',
      );
      warnSpy.mockRestore();
    });
  });

  describe('createRoom', () => {
    it('should create room on LiveKit server and save in database', async () => {
      const dto: any = {
        title: 'English Chat #1!',
        target_language: 'EN',
      };
      const roomRow: any = {
        id: 'room-id-1',
        room_name: 'room-english-chat-1-123456789',
        title: dto.title,
        target_language: dto.target_language,
        host_id: 'host-1',
        is_active: true,
        speakers: ['host-1'],
        raised_hands: [],
        listeners_count: 1,
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.createRoom('host-1', dto);

      expect(mockCreateRoom).toHaveBeenCalled();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audio_rooms');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          target_language: dto.target_language,
          host_id: 'host-1',
          is_active: true,
          speakers: ['host-1'],
          raised_hands: [],
          listeners_count: 1,
        }),
      );
      expect(result).toEqual({
        ...roomRow,
        host: {
          id: 'host-1',
          display_name: 'Host User',
          avatar_url: 'avatar.png',
        },
      });
    });

    it('should log warning when LiveKit createRoom throws error but still create in database', async () => {
      mockCreateRoom.mockRejectedValueOnce(new Error('LiveKit unreachable'));
      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});

      const dto: any = { title: 'French Room', target_language: 'FR' };
      const roomRow: any = {
        id: 'room-id-2',
        room_name: 'room-french-room-123',
        title: dto.title,
        host_id: 'host-1',
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.createRoom('host-1', dto);

      expect(warnSpy).toHaveBeenCalledWith(
        'LiveKit server createRoom warning (LiveKit unreachable). Continuing database creation.',
      );
      expect(result.id).toBe('room-id-2');
      warnSpy.mockRestore();
    });

    it('should throw Error when database insert fails', async () => {
      const dto: any = { title: 'Bad Room', target_language: 'EN' };
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert constraint error' },
      });

      await expect(service.createRoom('host-1', dto)).rejects.toThrow(
        'Failed to create audio room: Insert constraint error',
      );
    });
  });

  describe('generateToken', () => {
    it('should throw NotFoundException when room name not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.generateToken('user-1', { room_name: 'non-existent' }),
      ).rejects.toThrow(
        new NotFoundException("Audio room 'non-existent' not found."),
      );
    });

    it('should generate token for host speaker without incrementing listener count', async () => {
      const roomRow: any = {
        id: 'room-id-1',
        room_name: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1'],
        listeners_count: 5,
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.generateToken('host-1', {
        room_name: 'room-1',
      });

      expect(AccessToken).toHaveBeenCalledWith(
        'test-key',
        'secret-secret-secret-secret-secret',
        expect.objectContaining({
          identity: expect.stringContaining('Host User'),
          name: 'Host User',
        }),
      );
      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'room-1',
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        token: 'mock-livekit-jwt',
        room_id: 'room-id-1',
        room_name: 'room-1',
        livekit_url: 'https://test.livekit.cloud',
        is_speaker: true,
        user_id: 'host-1',
      });
    });

    it('should generate token for listener and increment listeners_count', async () => {
      const roomRow: any = {
        id: 'room-id-1',
        room_name: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1'],
        listeners_count: 5,
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });
      (usersService.getProfile as jest.Mock).mockResolvedValueOnce({
        id: 'listener-1',
        display_name: 'Listener',
      });

      const result = await service.generateToken('listener-1', {
        room_name: 'room-1',
      });

      expect(mockAddGrant).toHaveBeenCalledWith(
        expect.objectContaining({ canPublish: false }),
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        listeners_count: 6,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'room-id-1');
      expect(result.is_speaker).toBe(false);
    });
  });

  describe('listActiveRooms', () => {
    it('should return empty array when no active rooms found', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.listActiveRooms();
      expect(result).toEqual([]);
    });

    it('should return active rooms with populated host profiles', async () => {
      const activeRooms: any[] = [
        { id: 'room-1', host_id: 'host-1', is_active: true },
        { id: 'room-2', host_id: 'host-2', is_active: true },
      ];
      const hostProfiles: any[] = [
        { id: 'host-1', display_name: 'Host One', avatar_url: 'one.png' },
      ];

      mockQueryBuilder.limit.mockResolvedValueOnce({
        data: activeRooms,
        error: null,
      });
      mockQueryBuilder.in.mockResolvedValueOnce({
        data: hostProfiles,
        error: null,
      });

      const result = await service.listActiveRooms();

      expect(result).toHaveLength(2);
      expect(result[0].host).toEqual({
        id: 'host-1',
        display_name: 'Host One',
        avatar_url: 'one.png',
      });
      expect(result[1].host).toEqual({
        id: 'host-2',
        display_name: 'Room Host',
        avatar_url: null,
      });
    });
  });

  describe('getRoom', () => {
    it('should return room record with host profile', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.getRoom('room-1');
      expect(result.id).toBe('room-1');
      expect(result.host.display_name).toBe('Host User');
    });

    it('should throw NotFoundException when room not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.getRoom('non-existent')).rejects.toThrow(
        new NotFoundException('Audio room not found'),
      );
    });
  });

  describe('raiseHand', () => {
    it('should throw NotFoundException if room not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.raiseHand('user-1', { room_id: 'room-1' }),
      ).rejects.toThrow(new NotFoundException('Room not found'));
    });

    it('should return room unchanged if user already raised hand or is speaker', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        raised_hands: ['user-1'],
        speakers: ['host-1'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.raiseHand('user-1', { room_id: 'room-1' });
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(result.id).toBe('room-1');
    });

    it('should update raised_hands array and publish event when hand raised', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        raised_hands: [],
        speakers: ['host-1'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.raiseHand('user-2', { room_id: 'room-1' });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        raised_hands: ['user-2'],
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'raise_hand',
        user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });
  });

  describe('approveSpeaker', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.approveSpeaker('other-user', {
          room_id: 'room-1',
          target_user_id: 'user-2',
        }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only the host can approve stage speaker requests.',
        ),
      );
    });

    it('should remove user from raised_hands, add to speakers, and publish event', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        raised_hands: ['user-2', 'user-3'],
        speakers: ['host-1'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.approveSpeaker('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        raised_hands: ['user-3'],
        speakers: ['host-1', 'user-2'],
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'speaker_approved',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });
  });

  describe('demoteSpeaker', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.demoteSpeaker('other-user', {
          room_id: 'room-1',
          target_user_id: 'user-2',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can demote a stage speaker.'),
      );
    });

    it('should throw ForbiddenException when attempting to demote the host', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.demoteSpeaker('host-1', {
          room_id: 'room-1',
          target_user_id: 'host-1',
        }),
      ).rejects.toThrow(new ForbiddenException('The host cannot be demoted.'));
    });

    it('should remove user from speakers and publish speaker_demoted event', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1', 'user-2'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.demoteSpeaker('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        speakers: ['host-1'],
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'speaker_demoted',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });
  });

  describe('sendCaption', () => {
    it('should save caption and broadcast via Centrifugo', async () => {
      const dto: any = { room_id: 'room-1', text_content: 'Welcome everyone' };
      const savedCaption: any = {
        id: 'caption-1',
        room_id: 'room-1',
        speaker_id: 'user-1',
        speaker_name: 'Host User',
        text_content: 'Welcome everyone',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: savedCaption,
        error: null,
      });

      const result = await service.sendCaption('user-1', dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'audio_room_captions',
      );
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        room_id: 'room-1',
        speaker_id: 'user-1',
        speaker_name: 'Host User',
        text_content: 'Welcome everyone',
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'subtitle',
        caption: savedCaption,
      });
      expect(result).toEqual(savedCaption);
    });

    it('should throw Error when caption insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });

      await expect(
        service.sendCaption('user-1', {
          room_id: 'room-1',
          text_content: 'Test',
        }),
      ).rejects.toThrow('Failed to save caption: DB error');
    });
  });

  describe('archiveRoom', () => {
    it('should throw ForbiddenException if non-host tries to archive', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.archiveRoom('other-user', { room_id: 'room-1' }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can archive this room.'),
      );
    });

    it('should archive room, set recording URL, and broadcast event', async () => {
      const roomRow: any = {
        id: 'room-1',
        room_name: 'my-room',
        host_id: 'host-1',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.archiveRoom('host-1', {
        room_id: 'room-1',
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_active: false,
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'room_ended',
        room_id: 'room-1',
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });
      expect(result.id).toBe('room-1');
    });
  });
});
