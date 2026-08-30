import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  VIDEO_CALLS_RATE_LIMIT_KEY,
  VideoCallsRateLimiterGuard,
} from './video-calls-rate-limiter.guard';

describe('VideoCallsController', () => {
  let controller: VideoCallsController;
  let videoCallsService: VideoCallsService;

  const mockUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'test@hellotalk.com',
  };
  const remoteUserId = '22222222-2222-4222-8222-222222222222';
  const roomName = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';

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
        {
          provide: VideoCallsRateLimiterGuard,
          useValue: { canActivate: vi.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(VideoCallsRateLimiterGuard)
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

  it('should attach authentication and video-call rate-limit guards', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      VideoCallsController,
    ) as unknown[];

    expect(guards).toEqual(
      expect.arrayContaining([SupabaseAuthGuard, VideoCallsRateLimiterGuard]),
    );
  });

  it('should rate-limit call mutations while leaving health unmetered', () => {
    expect(
      Reflect.getMetadata(
        VIDEO_CALLS_RATE_LIMIT_KEY,
        VideoCallsController.prototype.startCall,
      ),
    ).toEqual({ maxRequests: 3, windowSeconds: 60 });
    expect(
      Reflect.getMetadata(
        VIDEO_CALLS_RATE_LIMIT_KEY,
        VideoCallsController.prototype.acceptCall,
      ),
    ).toEqual({ maxRequests: 10, windowSeconds: 60 });
    expect(
      Reflect.getMetadata(
        VIDEO_CALLS_RATE_LIMIT_KEY,
        VideoCallsController.prototype.health,
      ),
    ).toBeUndefined();
  });

  describe('startCall', () => {
    it('should bind room creation to the authenticated caller and intended recipient', async () => {
      const mockResponse = {
        token: 'livekit-token',
        roomName,
        e2eeKey: 'ephemeral-key',
      };
      (videoCallsService.createRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.startCall(req, { remoteUserId });

      expect(videoCallsService.createRoom).toHaveBeenCalledWith(
        mockUser.id,
        remoteUserId,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return encryption and degraded state from the service unchanged', async () => {
      const mockResponse = {
        token: 'fallback-token',
        roomName,
        e2eeKey: 'ephemeral-key',
        degraded: true,
        degradationReason: 'Service livekit failed: timeout',
      };
      (videoCallsService.createRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.startCall(req, { remoteUserId });

      expect(result).toEqual(mockResponse);
      expect(result.e2eeKey).toBe('ephemeral-key');
      expect(result.degraded).toBe(true);
    });

    it('should propagate errors from the service', async () => {
      (videoCallsService.createRoom as Mock).mockRejectedValue(
        new Error('Encrypted calls unavailable'),
      );

      const req = { user: mockUser } as any;

      await expect(controller.startCall(req, { remoteUserId })).rejects.toThrow(
        'Encrypted calls unavailable',
      );
    });
  });

  describe('acceptCall', () => {
    it('should request join material for the authenticated participant', async () => {
      const mockResponse = {
        token: 'livekit-join-token',
        roomName,
        e2eeKey: 'same-ephemeral-key',
      };
      (videoCallsService.joinRoom as Mock).mockResolvedValue(mockResponse);

      const req = { user: mockUser } as any;
      const result = await controller.acceptCall(req, { roomName });

      expect(videoCallsService.joinRoom).toHaveBeenCalledWith(
        mockUser.id,
        roomName,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should propagate authorization and availability errors from the service', async () => {
      (videoCallsService.joinRoom as Mock).mockRejectedValue(
        new Error('Call is unavailable'),
      );

      const req = { user: mockUser } as any;

      await expect(controller.acceptCall(req, { roomName })).rejects.toThrow(
        'Call is unavailable',
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
