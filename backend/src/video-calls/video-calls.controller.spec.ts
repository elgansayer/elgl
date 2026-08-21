import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('VideoCallsController', () => {
  let controller: VideoCallsController;
  let videoCallsService: VideoCallsService;

  const mockUser = { id: 'user-1', email: 'test@hellotalk.com' };

  const mockDegradationService = {
    getAllBreakerStates: vi.fn().mockReturnValue(new Map()),
    getRecentDegradationEvents: vi.fn().mockResolvedValue([]),
    isAvailable: vi.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoCallsController],
      providers: [
        {
          provide: VideoCallsService,
          useValue: {
            createRoom: vi.fn(),
            joinRoom: vi.fn(),
          },
        },
        {
          provide: VideoCallsDegradationService,
          useValue: mockDegradationService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<VideoCallsController>(VideoCallsController);
    videoCallsService = module.get<VideoCallsService>(VideoCallsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startCall', () => {
    it('should create a room and return the sanitised response', async () => {
      const mockResponse = { token: 'livekit-token', roomName: 'video_abc123' };
      (videoCallsService.createRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.startCall(req);

      expect(videoCallsService.createRoom).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResponse);
    });

    it('should return degraded flag from the service', async () => {
      const mockResponse = {
        token: 'fallback-token',
        roomName: 'video_abc123',
        degraded: true,
        degradationReason: 'Service livekit failed: timeout',
      };
      (videoCallsService.createRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.startCall(req);

      expect(result).toEqual(mockResponse);
      expect(result.degraded).toBe(true);
    });

    it('should propagate errors from the service', async () => {
      (videoCallsService.createRoom as Mock).mockRejectedValue(
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
      (videoCallsService.joinRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.acceptCall(req, 'room-1');

      expect(videoCallsService.joinRoom).toHaveBeenCalledWith(
        'user-1',
        'room-1',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass sanitised room name to the service', async () => {
      (videoCallsService.joinRoom as Mock).mockResolvedValue({
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
      (videoCallsService.joinRoom as Mock).mockRejectedValue(
        new Error('Room not found'),
      );

      const req = { user: mockUser } as any;

      await expect(controller.acceptCall(req, 'no-room')).rejects.toThrow(
        'Room not found',
      );
    });
  });

  describe('health', () => {
    it('should return healthy when no breakers are open', async () => {
      const breakerStates = new Map([
        [
          'livekit',
          {
            isOpen: false,
            failureCount: 0,
            totalFailures: 0,
            totalSuccesses: 10,
            lastFailure: 0,
            cooldownUntil: 0,
          },
        ],
      ]);
      mockDegradationService.getAllBreakerStates.mockReturnValue(breakerStates);
      mockDegradationService.getRecentDegradationEvents.mockResolvedValue([]);

      const result = await controller.health();

      expect(result.status).toBe('healthy');
      expect(result.breakers.livekit.isOpen).toBe(false);
    });

    it('should return degraded when a breaker is open', async () => {
      const breakerStates = new Map([
        [
          'livekit',
          {
            isOpen: true,
            failureCount: 3,
            totalFailures: 5,
            totalSuccesses: 10,
            lastFailure: Date.now(),
            cooldownUntil: Date.now() + 30000,
          },
        ],
      ]);
      mockDegradationService.getAllBreakerStates.mockReturnValue(breakerStates);

      const result = await controller.health();

      expect(result.status).toBe('degraded');
    });
  });
});
