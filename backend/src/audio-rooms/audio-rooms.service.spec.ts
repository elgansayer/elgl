import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AudioRoomsService } from './audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { TranscriptEgressService } from './transcript-egress.service';
import { NlpService } from '../nlp/nlp.service';
import { ChatLlmService } from '../chat/chat-llm.service';
import { CloudflareCacheService } from '../cloudflare/cache.service';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { R2Service } from '../cloudflare-r2/r2.service';

const mockCreateRoom = vi.fn().mockResolvedValue({});
const mockAddGrant = vi.fn();
const mockToJwt = vi.fn().mockResolvedValue('mock-livekit-jwt');

vi.mock('livekit-server-sdk', () => ({
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
}));

describe('AudioRoomsService', () => {
  let service: AudioRoomsService;
  let usersService: UsersService;
  let centrifugoService: CentrifugoService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockGenerateTranscriptFromAudioUrl: Mock;

  beforeEach(async () => {
    mockCreateRoom.mockClear().mockResolvedValue({});
    mockAddGrant.mockClear();
    mockToJwt.mockClear().mockResolvedValue('mock-livekit-jwt');
    mockGenerateTranscriptFromAudioUrl = vi.fn();
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioRoomsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
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
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getProfile: vi.fn().mockResolvedValue({
              id: 'host-1',
              display_name: 'Host User',
              avatar_url: 'avatar.png',
            }),
          },
        },
        {
          provide: CentrifugoService,
          useValue: {
            publish: vi.fn().mockResolvedValue(true),
          },
        },
        {
          provide: TranscriptEgressService,
          useValue: {
            startEgress: vi.fn(),
            stopEgress: vi.fn(),
            generateTranscriptFromAudioUrl: mockGenerateTranscriptFromAudioUrl,
          },
        },
        {
          provide: NlpService,
          useValue: {
            generateSessionSummary: vi.fn().mockResolvedValue({
              summary: 'Key topics covered:\nTest summary sentence.',
              vocabulary: ['test', 'summary', 'vocabulary'],
            }),
          },
        },
        {
          provide: R2Service,
          useValue: {
            generateUploadUrl: vi.fn(),
          },
        },
        {
          provide: ChatLlmService,
          useValue: {
            chatCompletion: vi.fn().mockResolvedValue(
              JSON.stringify({
                summary: 'Key topics:\n- Introductions\n- Travel experiences',
                vocabulary: ['greetings', 'holiday', 'culture'],
              }),
            ),
          },
        },
        {
          provide: CloudflareCacheService,
          useValue: {
            purgeByCacheTags: vi.fn().mockResolvedValue(true),
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
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise LiveKit RoomServiceClient and log warning if construction throws', () => {
      (RoomServiceClient as unknown as Mock).mockImplementationOnce(
        function () {
          throw new Error('SDK init failure');
        },
      );
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});

      service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        'Could not init LiveKit RoomServiceClient (SDK init failure). Will fall back to local/mock.',
      );
      warnSpy.mockRestore();
    });

    describe('disableBiometricLock', () => {
      it('should disable biometric lock for the room', async () => {
        const roomRow: any = {
          id: 'room-1',
          host_id: 'host-1',
          biometric_lock: true,
        };
        mockQueryBuilder.single.mockResolvedValue({
          data: roomRow,
          error: null,
        });

        const result = await service.disableBiometricLock('host-1', {
          room_id: 'room-1',
        });

        expect(mockQueryBuilder.update).toHaveBeenCalledWith({
          biometric_lock: false,
        });
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'room-1');
        expect(result.biometric_lock).toBe(false);
      });

      it('should throw ForbiddenException if non-host tries to disable biometric lock', async () => {
        const roomRow: any = {
          id: 'room-1',
          host_id: 'host-1',
          biometric_lock: true,
        };
        mockQueryBuilder.single.mockResolvedValue({
          data: roomRow,
          error: null,
        });

        await expect(
          service.disableBiometricLock('other-user', { room_id: 'room-1' }),
        ).rejects.toThrow(
          new ForbiddenException(
            'Only the host can disable biometric lock for this room.',
          ),
        );
      });

      it('should throw NotFoundException if room does not exist', async () => {
        mockQueryBuilder.single.mockResolvedValue({
          data: null,
          error: null,
        });

        await expect(
          service.disableBiometricLock('host-1', { room_id: 'non-existent' }),
        ).rejects.toThrow(new NotFoundException('Room not found'));
      });
    });
  });

  describe('createRoom', () => {
    it('should create room on LiveKit server and save in database', async () => {
      const dto: any = {
        title: 'English Chat #1!',
        target_language: 'EN',
        language_pair: 'FR-EN',
      };
      const roomRow: any = {
        id: 'room-id-1',
        room_name: 'room-english-chat-1-123456789',
        title: dto.title,
        target_language: dto.target_language,
        language_pair: dto.language_pair,
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
          language_pair: dto.language_pair,
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
      const warnSpy = vi
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});

      const dto: any = {
        title: 'French Room',
        target_language: 'FR',
        language_pair: 'EN-FR',
      };
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
      const dto: any = {
        title: 'Bad Room',
        target_language: 'EN',
        language_pair: 'FR-EN',
      };
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
      (usersService.getProfile as Mock).mockResolvedValueOnce({
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
      mockQueryBuilder.range.mockResolvedValue({
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

      mockQueryBuilder.range.mockResolvedValueOnce({
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

  describe('listActiveRoomsByLanguage', () => {
    it('should return empty array when no active rooms', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.listActiveRoomsByLanguage();
      expect(result).toEqual([]);
    });

    it('should group rooms by language_pair sorted by count descending', async () => {
      const activeRooms: any[] = [
        {
          id: 'room-1',
          host_id: 'host-1',
          language_pair: 'en-es',
          title: 'Room 1',
        },
        {
          id: 'room-2',
          host_id: 'host-2',
          language_pair: 'en-es',
          title: 'Room 2',
        },
        {
          id: 'room-3',
          host_id: 'host-3',
          language_pair: 'ar-en',
          title: 'Room 3',
        },
      ];
      const hostProfiles: any[] = [
        { id: 'host-1', display_name: 'Host One', avatar_url: 'one.png' },
        { id: 'host-2', display_name: 'Host Two', avatar_url: 'two.png' },
        { id: 'host-3', display_name: 'Host Three', avatar_url: 'three.png' },
      ];

      mockQueryBuilder.range.mockResolvedValueOnce({
        data: activeRooms,
        error: null,
      });
      mockQueryBuilder.in.mockResolvedValueOnce({
        data: hostProfiles,
        error: null,
      });

      const result = await service.listActiveRoomsByLanguage();

      expect(result).toHaveLength(2);
      // en-es group (count 2) should be first
      expect(result[0].language_pair).toBe('en-es');
      expect(result[0].count).toBe(2);
      expect(result[0].rooms).toHaveLength(2);
      // ar-en group (count 1) should be second
      expect(result[1].language_pair).toBe('ar-en');
      expect(result[1].count).toBe(1);
      expect(result[1].rooms).toHaveLength(1);
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

  describe('muteSpeaker', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.muteSpeaker('other-user', {
          room_id: 'room-1',
          target_user_id: 'user-2',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can mute a speaker.'),
      );
    });

    it('should throw ForbiddenException when attempting to mute the host', async () => {
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
        service.muteSpeaker('host-1', {
          room_id: 'room-1',
          target_user_id: 'host-1',
        }),
      ).rejects.toThrow(new ForbiddenException('The host cannot be muted.'));
    });

    it('should publish force_mute event via Centrifugo', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1', 'user-2'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.muteSpeaker('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'force_mute',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });
  });

  describe('kickSpeaker', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.kickSpeaker('other-user', {
          room_id: 'room-1',
          target_user_id: 'user-2',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can kick a speaker off stage.'),
      );
    });

    it('should throw ForbiddenException when attempting to kick the host', async () => {
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
        service.kickSpeaker('host-1', {
          room_id: 'room-1',
          target_user_id: 'host-1',
        }),
      ).rejects.toThrow(
        new ForbiddenException('The host cannot kick themselves.'),
      );
    });

    it('should remove from speakers, clear co-host if applicable, and publish force_kick event', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.kickSpeaker('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        speakers: ['host-1'],
        co_host_id: null,
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'force_kick',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'co_host_removed',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });

    it('should remove speaker without co-host events when target is not co-host', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1', 'user-2', 'user-3'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.kickSpeaker('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        speakers: ['host-1', 'user-3'],
        co_host_id: undefined,
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'force_kick',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(centrifugoService.publish).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('room-1');
    });
  });

  describe('inviteCoHost', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.inviteCoHost('other-user', {
          room_id: 'room-1',
          target_user_id: 'user-2',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can invite a co-host.'),
      );
    });

    it('should throw ForbiddenException if host invites themselves', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.inviteCoHost('host-1', {
          room_id: 'room-1',
          target_user_id: 'host-1',
        }),
      ).rejects.toThrow(
        new ForbiddenException('The host cannot co-host their own room.'),
      );
    });

    it('should set co_host_id, add to speakers, clear raised hand, and publish event', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1'],
        raised_hands: ['user-2'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
        raised_hands: [],
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'co_host_changed',
        target_user_id: 'user-2',
        previous_co_host_id: null,
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });

    it('should demote and notify the existing co-host before assigning a new one', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
        raised_hands: [],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-3',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        co_host_id: 'user-3',
        speakers: ['host-1', 'user-3'],
        raised_hands: [],
      });
      // The outgoing co-host's removal must be published before the incoming
      // co-host's invite so a late-arriving removal can never clobber the new
      // co-host assignment (regression test for the out-of-order event race).
      const publishCalls = (centrifugoService.publish as Mock).mock.calls;
      expect(publishCalls).toHaveLength(2);
      expect(publishCalls[0]).toEqual([
        'room_room-1',
        {
          type: 'co_host_removed',
          target_user_id: 'user-2',
          room_id: 'room-1',
        },
      ]);
      expect(publishCalls[1]).toEqual([
        'room_room-1',
        {
          type: 'co_host_changed',
          target_user_id: 'user-3',
          previous_co_host_id: 'user-2',
          room_id: 'room-1',
        },
      ]);
      expect(result.id).toBe('room-1');
    });

    it('should await the co_host_removed publish before publishing co_host_changed', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
        raised_hands: [],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      let releaseRemoved = (): void => {};
      const removedPending = new Promise<boolean>((resolve) => {
        releaseRemoved = () => resolve(true);
      });
      const publishMock = centrifugoService.publish as Mock;
      publishMock.mockImplementationOnce(() => removedPending);

      const invitePromise = service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-3',
      });

      // Flush microtasks so the room lookup and DB update settle and the first
      // publish (co_host_removed) has been initiated but not yet completed.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(publishMock).toHaveBeenCalledTimes(1);
      expect(publishMock).toHaveBeenCalledWith('room_room-1', {
        type: 'co_host_removed',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });

      // The invite must not be published until the removal completes.
      releaseRemoved();
      await invitePromise;

      expect(publishMock).toHaveBeenCalledTimes(2);
      expect(publishMock).toHaveBeenLastCalledWith('room_room-1', {
        type: 'co_host_changed',
        target_user_id: 'user-3',
        previous_co_host_id: 'user-2',
        room_id: 'room-1',
      });
    });

    it('should not publish a demotion event when re-inviting the same co-host', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
        raised_hands: [],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await service.inviteCoHost('host-1', {
        room_id: 'room-1',
        target_user_id: 'user-2',
      });

      expect(centrifugoService.publish).not.toHaveBeenCalledWith(
        'room_room-1',
        expect.objectContaining({ type: 'co_host_removed' }),
      );
    });
  });

  describe('removeCoHost', () => {
    it('should throw ForbiddenException if user is not host', async () => {
      const roomRow: any = { id: 'room-1', host_id: 'host-1' };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await expect(
        service.removeCoHost('other-user', { room_id: 'room-1' }),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can remove the co-host.'),
      );
    });

    it('should clear co_host_id, remove from speakers, and publish event', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: 'user-2',
        speakers: ['host-1', 'user-2'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      const result = await service.removeCoHost('host-1', {
        room_id: 'room-1',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        co_host_id: null,
        speakers: ['host-1'],
      });
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'co_host_removed',
        target_user_id: 'user-2',
        room_id: 'room-1',
      });
      expect(result.id).toBe('room-1');
    });

    it('should not publish event when there is no co-host to remove', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        co_host_id: null,
        speakers: ['host-1'],
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      await service.removeCoHost('host-1', { room_id: 'room-1' });

      expect(centrifugoService.publish).not.toHaveBeenCalled();
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

    it('should archive room, generate AI session summary, and broadcast event', async () => {
      const roomRow: any = {
        id: 'room-1',
        room_name: 'my-room',
        host_id: 'host-1',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: roomRow,
        error: null,
      });

      // Set up transcript egress to return a transcript to feed the AI summary
      mockGenerateTranscriptFromAudioUrl.mockResolvedValue(
        'Hello everyone! Welcome to the language exchange. Today we discussed travel experiences and favourite holiday destinations.',
      );

      const result = await service.archiveRoom('host-1', {
        room_id: 'room-1',
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_active: false,
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          room_id: 'room-1',
          recording_url: 'https://r2.hellotalk.mock/test.webm',
          session_summary: expect.stringContaining('Key topics'),
          vocabulary_list: ['greetings', 'holiday', 'culture'],
        }),
        { onConflict: 'room_id' },
      );
      expect(centrifugoService.publish).toHaveBeenCalledWith('room_room-1', {
        type: 'room_ended',
        room_id: 'room-1',
        recording_url: 'https://r2.hellotalk.mock/test.webm',
      });
      expect(result.id).toBe('room-1');
    });
  });

  describe('getCallLogs', () => {
    it('should return call logs involving the current user', async () => {
      const logs: any[] = [
        {
          id: 'log-1',
          caller_id: 'user-1',
          receiver_id: 'user-2',
          call_type: 'outgoing',
        },
      ];
      mockQueryBuilder.range.mockResolvedValueOnce({ data: logs, error: null });

      const result = await service.getCallLogs('user-1', {
        limit: 20,
        offset: 0,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('call_logs');
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'caller_id.eq.user-1,receiver_id.eq.user-1',
      );
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 19);
      expect(result).toEqual(logs);
    });

    it('should filter by callType when provided', async () => {
      const logs: any[] = [
        {
          id: 'log-2',
          caller_id: 'user-2',
          receiver_id: 'user-1',
          call_type: 'missed',
        },
      ];
      mockQueryBuilder.eq.mockResolvedValueOnce({ data: logs, error: null });

      const result = await service.getCallLogs('user-1', {
        callType: 'missed',
        limit: 20,
        offset: 0,
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('call_type', 'missed');
      expect(result).toEqual(logs);
    });

    it('should return an empty array and log a warning on error', async () => {
      mockQueryBuilder.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      });

      const result = await service.getCallLogs('user-1', {
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual([]);
    });
  });

  describe('enableBiometricLock', () => {
    it('should enable biometric lock for the room', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        biometric_lock: false,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: roomRow, error: null });

      const result = await service.enableBiometricLock('host-1', {
        room_id: 'room-1',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        biometric_lock: true,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'room-1');
      expect(result.biometric_lock).toBe(true);
    });

    it('should throw ForbiddenException if non-host tries to enable biometric lock', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        biometric_lock: false,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: roomRow, error: null });

      await expect(
        service.enableBiometricLock('other-user', { room_id: 'room-1' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only the host can enable biometric lock for this room.',
        ),
      );
    });

    it('should throw NotFoundException if room does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });

      await expect(
        service.enableBiometricLock('host-1', { room_id: 'non-existent' }),
      ).rejects.toThrow(new NotFoundException('Room not found'));
    });
  });

  describe('disableBiometricLock', () => {
    it('should disable biometric lock for the room', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        biometric_lock: true,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: roomRow, error: null });

      const result = await service.disableBiometricLock('host-1', {
        room_id: 'room-1',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        biometric_lock: false,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'room-1');
      expect(result.biometric_lock).toBe(false);
    });

    it('should throw ForbiddenException if non-host tries to disable biometric lock', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        biometric_lock: true,
      };
      mockQueryBuilder.single.mockResolvedValue({ data: roomRow, error: null });

      await expect(
        service.disableBiometricLock('other-user', { room_id: 'room-1' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only the host can disable biometric lock for this room.',
        ),
      );
    });

    it('should throw NotFoundException if room does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });

      await expect(
        service.disableBiometricLock('host-1', { room_id: 'non-existent' }),
      ).rejects.toThrow(new NotFoundException('Room not found'));
    });
  });

  describe('tipHost', () => {
    it('should throw NotFoundException when room not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        service.tipHost('user-1', { room_id: 'room-1', amount_coins: 10 }),
      ).rejects.toThrow(new NotFoundException('Room not found'));
    });

    it('should throw BadRequestException when tipping yourself', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        is_active: true,
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: roomRow,
        error: null,
      });

      await expect(
        service.tipHost('host-1', { room_id: 'room-1', amount_coins: 10 }),
      ).rejects.toThrow(new BadRequestException('You cannot tip yourself'));
    });

    it('should throw BadRequestException when insufficient coins', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        is_active: true,
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: roomRow,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 5 },
        error: null,
      });

      await expect(
        service.tipHost('user-1', { room_id: 'room-1', amount_coins: 10 }),
      ).rejects.toThrow('Insufficient coins');
    });

    it('should process tip and return success details', async () => {
      const roomRow: any = {
        id: 'room-1',
        host_id: 'host-1',
        is_active: true,
      };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: roomRow,
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 100, display_name: 'Alice' },
        error: null,
      });
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { coins_balance: 50 },
        error: null,
      });
      const tipRow = { id: 'tip-1', amount_coins: 10 };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: tipRow,
        error: null,
      });

      const result = await service.tipHost('user-1', {
        room_id: 'room-1',
        amount_coins: 10,
      });

      expect(result.tip_id).toBe('tip-1');
      expect(result.receiver_new_balance).toBe(60);
      expect(mockQueryBuilder.update).toHaveBeenCalledTimes(2);
    });
  });
});
