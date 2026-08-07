import { Test, TestingModule } from '@nestjs/testing';
import { AudioRoomsController } from './audio-rooms.controller';
import { AudioRoomsService } from './audio-rooms.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CallLogRecord } from './interfaces/call-log.interface';

describe('AudioRoomsController', () => {
  let controller: AudioRoomsController;
  let audioRoomsService: AudioRoomsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AudioRoomsController],
      providers: [
        {
          provide: AudioRoomsService,
          useValue: {
            createRoom: jest.fn(),
            generateToken: jest.fn(),
            listActiveRooms: jest.fn(),
            getDistinctTopics: jest.fn(),
            getDistinctLevels: jest.fn(),
            getInvitedPrivateRooms: jest.fn(),
            getRoom: jest.fn(),
            getStage: jest.fn(),
            reorderSpeakers: jest.fn(),
            clearStage: jest.fn(),
            createLanguageParty: jest.fn(),
            createPrivateRoom: jest.fn(),
            raiseHand: jest.fn(),
            approveSpeaker: jest.fn(),
            muteSpeaker: jest.fn(),
            unmuteSpeaker: jest.fn(),
            demoteSpeaker: jest.fn(),
            kickSpeaker: jest.fn(),
            inviteCoHost: jest.fn(),
            removeCoHost: jest.fn(),
            sendCaption: jest.fn(),
            archiveRoom: jest.fn(),
            addNote: jest.fn(),
            getNotes: jest.fn(),
            deleteNote: jest.fn(),
            getTranscript: jest.fn(),
            getCallLogs: jest.fn(),
            createPoll: jest.fn(),
            submitVote: jest.fn(),
            getPollResults: jest.fn(),
            getSoundboardSounds: jest.fn(),
            playSound: jest.fn(),
            sendReaction: jest.fn(),
            getExclusiveEmojis: jest.fn(),
            tipHost: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AudioRoomsController>(AudioRoomsController);
    audioRoomsService = module.get<AudioRoomsService>(AudioRoomsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRoom', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createRoom(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.createRoom).not.toHaveBeenCalled();
    });

    it('should call service createRoom when user is provided', async () => {
      const dto: any = { title: 'Test Room', target_language: 'EN' };
      const room: any = { id: 'room-1', title: 'Test Room' };
      (audioRoomsService.createRoom as jest.Mock).mockResolvedValue(room);

      const result = await controller.createRoom({ id: 'user-1' }, dto);
      expect(audioRoomsService.createRoom).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('generateToken', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateToken(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.generateToken).not.toHaveBeenCalled();
    });

    it('should call service generateToken when user is provided', async () => {
      const dto: any = { room_name: 'room-1' };
      const tokenResponse: any = { token: 'jwt-token' };
      (audioRoomsService.generateToken as jest.Mock).mockResolvedValue(
        tokenResponse,
      );

      const result = await controller.generateToken({ id: 'user-1' }, dto);
      expect(audioRoomsService.generateToken).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(tokenResponse);
    });
  });

  describe('listActiveRooms', () => {
    it('should return active rooms from service', async () => {
      const rooms: any[] = [{ id: 'room-1' }];
      (audioRoomsService.listActiveRooms as jest.Mock).mockResolvedValue(rooms);

      const result = await controller.listActiveRooms();
      expect(audioRoomsService.listActiveRooms).toHaveBeenCalled();
      expect(result).toEqual(rooms);
    });
  });

  describe('getRoom', () => {
    it('should return specific room by ID', async () => {
      const room: any = { id: 'room-1' };
      (audioRoomsService.getRoom as jest.Mock).mockResolvedValue(room);

      const result = await controller.getRoom('room-1');
      expect(audioRoomsService.getRoom).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(room);
    });
  });

  describe('raiseHand', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.raiseHand(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.raiseHand).not.toHaveBeenCalled();
    });

    it('should call service raiseHand when user is provided', async () => {
      const dto: any = { room_id: 'room-1' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.raiseHand as jest.Mock).mockResolvedValue(room);

      const result = await controller.raiseHand({ id: 'user-1' }, dto);
      expect(audioRoomsService.raiseHand).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('approveSpeaker', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.approveSpeaker(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.approveSpeaker).not.toHaveBeenCalled();
    });

    it('should call service approveSpeaker when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.approveSpeaker as jest.Mock).mockResolvedValue(room);

      const result = await controller.approveSpeaker({ id: 'user-1' }, dto);
      expect(audioRoomsService.approveSpeaker).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(room);
    });
  });

  describe('demoteSpeaker', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.demoteSpeaker(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.demoteSpeaker).not.toHaveBeenCalled();
    });

    it('should call service demoteSpeaker when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.demoteSpeaker as jest.Mock).mockResolvedValue(room);

      const result = await controller.demoteSpeaker({ id: 'user-1' }, dto);
      expect(audioRoomsService.demoteSpeaker).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(room);
    });
  });

  describe('muteSpeaker', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.muteSpeaker(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.muteSpeaker).not.toHaveBeenCalled();
    });

    it('should call service muteSpeaker when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.muteSpeaker as jest.Mock).mockResolvedValue(room);

      const result = await controller.muteSpeaker({ id: 'user-1' }, dto);
      expect(audioRoomsService.muteSpeaker).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('unmuteSpeaker', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.unmuteSpeaker(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.unmuteSpeaker).not.toHaveBeenCalled();
    });

    it('should call service unmuteSpeaker when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.unmuteSpeaker as jest.Mock).mockResolvedValue(room);

      const result = await controller.unmuteSpeaker({ id: 'user-1' }, dto);
      expect(audioRoomsService.unmuteSpeaker).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('kickSpeaker', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.kickSpeaker(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.kickSpeaker).not.toHaveBeenCalled();
    });

    it('should call service kickSpeaker when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1' };
      (audioRoomsService.kickSpeaker as jest.Mock).mockResolvedValue(room);

      const result = await controller.kickSpeaker({ id: 'user-1' }, dto);
      expect(audioRoomsService.kickSpeaker).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('inviteCoHost', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.inviteCoHost(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.inviteCoHost).not.toHaveBeenCalled();
    });

    it('should call service inviteCoHost when user is provided', async () => {
      const dto: any = { room_id: 'room-1', target_user_id: 'user-2' };
      const room: any = { id: 'room-1', co_host_id: 'user-2' };
      (audioRoomsService.inviteCoHost as jest.Mock).mockResolvedValue(room);

      const result = await controller.inviteCoHost({ id: 'user-1' }, dto);
      expect(audioRoomsService.inviteCoHost).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(room);
    });
  });

  describe('removeCoHost', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.removeCoHost(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.removeCoHost).not.toHaveBeenCalled();
    });

    it('should call service removeCoHost when user is provided', async () => {
      const dto: any = { room_id: 'room-1' };
      const room: any = { id: 'room-1', co_host_id: null };
      (audioRoomsService.removeCoHost as jest.Mock).mockResolvedValue(room);

      const result = await controller.removeCoHost({ id: 'user-1' }, dto);
      expect(audioRoomsService.removeCoHost).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(room);
    });
  });

  describe('sendCaption', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.sendCaption(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.sendCaption).not.toHaveBeenCalled();
    });

    it('should call service sendCaption when user is provided', async () => {
      const dto: any = { room_id: 'room-1', text_content: 'Caption text' };
      const caption: any = { id: 'cap-1', text_content: 'Caption text' };
      (audioRoomsService.sendCaption as jest.Mock).mockResolvedValue(caption);

      const result = await controller.sendCaption({ id: 'user-1' }, dto);
      expect(audioRoomsService.sendCaption).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(caption);
    });
  });

  describe('getCallLogs', () => {
    it('should return an empty array if user is not provided', async () => {
      const result = await controller.getCallLogs(null, {});
      expect(result).toEqual([]);
      expect(audioRoomsService.getCallLogs).not.toHaveBeenCalled();
    });

    it('should call service getCallLogs with the current user id and query', async () => {
      const query: any = { callType: 'missed', limit: 20, offset: 0 };
      const logs: CallLogRecord[] = [
        {
          id: 'log-1',
          caller_id: 'user-2',
          caller_name: 'Sam',
          receiver_id: 'user-1',
          receiver_name: 'Alex',
          call_type: 'missed',
          room_name: 'room-1',
          started_at: '2026-08-01T10:00:00Z',
          ended_at: null,
          duration_seconds: null,
          created_at: '2026-08-01T10:00:00Z',
        },
      ];
      (audioRoomsService.getCallLogs as jest.Mock).mockResolvedValue(logs);

      const result = await controller.getCallLogs({ id: 'user-1' }, query);
      expect(audioRoomsService.getCallLogs).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual(logs);
    });
  });

  describe('archiveRoom', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.archiveRoom(null, {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.archiveRoom).not.toHaveBeenCalled();
    });

    it('should call service archiveRoom when user is provided', async () => {
      const dto: any = { room_id: 'room-1' };
      const room: any = { id: 'room-1', is_active: false };
      (audioRoomsService.archiveRoom as jest.Mock).mockResolvedValue(room);

      const result = await controller.archiveRoom({ id: 'user-1' }, dto);
      expect(audioRoomsService.archiveRoom).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(room);
    });
  });

  describe('tipHost', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.tipHost(null, 'room-1', {} as any);
      expect(result).toBeNull();
      expect(audioRoomsService.tipHost).not.toHaveBeenCalled();
    });

    it('should call service tipHost when user is provided', async () => {
      const dto: any = { amount_coins: 10 };
      const resultPayload: any = {
        tip_id: 'tip-1',
        amount_coins: 10,
        receiver_id: 'host-1',
        receiver_new_balance: 60,
      };
      (audioRoomsService.tipHost as jest.Mock).mockResolvedValue(resultPayload);

      const result = await controller.tipHost({ id: 'user-1' }, 'room-1', dto);

      expect(audioRoomsService.tipHost).toHaveBeenCalledWith('user-1', {
        room_id: 'room-1',
        amount_coins: 10,
      });
      expect(result).toEqual(resultPayload);
    });
  });
});
