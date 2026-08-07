import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('VideoCallsController', () => {
  let controller: VideoCallsController;
  let videoCallsService: VideoCallsService;

  const mockUser = { id: 'user-1', email: 'test@hellotalk.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoCallsController],
      providers: [
        {
          provide: VideoCallsService,
          useValue: {
            createRoom: jest.fn(),
            joinRoom: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<VideoCallsController>(VideoCallsController);
    videoCallsService = module.get<VideoCallsService>(VideoCallsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startCall', () => {
    it('should create a room and return the sanitised response', async () => {
      const mockResponse = { token: 'livekit-token', roomName: 'video_abc123' };
      (videoCallsService.createRoom as jest.Mock).mockResolvedValue(
        mockResponse,
      );

      const req = { user: mockUser } as any;
      const result = await controller.startCall(req);

      expect(videoCallsService.createRoom).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors from the service', async () => {
      (videoCallsService.createRoom as jest.Mock).mockRejectedValue(
        new Error('LiveKit unavailable'),
      );

      const req = { user: mockUser } as any;

      await expect(controller.startCall(req)).rejects.toThrow(
        'LiveKit unavailable',
      );
    });
  });

  describe('acceptCall', () => {
    it('should join a room and return the sanitised response', async () => {
      const mockResponse = { token: 'livekit-join-token', roomName: 'room-1' };
      (videoCallsService.joinRoom as jest.Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.acceptCall(req, 'room-1');

      expect(videoCallsService.joinRoom).toHaveBeenCalledWith(
        'user-1',
        'room-1',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass sanitised room name to the service', async () => {
      (videoCallsService.joinRoom as jest.Mock).mockResolvedValue({
        token: 'tok',
        roomName: 'clean-room',
      });

      const req = { user: mockUser } as any;
      const result = await controller.acceptCall(req, 'clean-room');

      expect(videoCallsService.joinRoom).toHaveBeenCalledWith(
        'user-1',
        'clean-room',
      );
      expect(result).toEqual({ token: 'tok', roomName: 'clean-room' });
    });

    it('should propagate errors from the service', async () => {
      (videoCallsService.joinRoom as jest.Mock).mockRejectedValue(
        new Error('Room not found'),
      );

      const req = { user: mockUser } as any;

      await expect(controller.acceptCall(req, 'no-room')).rejects.toThrow(
        'Room not found',
      );
    });
  });
});
