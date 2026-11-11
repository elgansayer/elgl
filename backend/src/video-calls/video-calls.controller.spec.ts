import type { Mock } from 'vitest';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';
import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { VideoExchangeTimerService } from './video-exchange-timer.service';
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
  const mockReq = { user: mockUser as unknown as User } as unknown as Request;
  const remoteUserId = '22222222-2222-4222-8222-222222222222';
  const roomName = 'video_a1b2c3d4-e5f6-4789-abcd-ef1234567890';

  const mockDegradationService = {
    getAllBreakerStates: vi.fn().mockReturnValue(new Map()),
    getRecentDegradationEvents: vi.fn().mockResolvedValue([]),
    isAvailable: vi.fn().mockReturnValue(true),
  };

  const mockExchangeTimerService = {
    getStatus: vi.fn(),
    advanceTurn: vi.fn(),
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
          provide: VideoExchangeTimerService,
          useValue: mockExchangeTimerService,
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
        VideoCallsController.prototype.advanceExchangeTimer,
      ),
    ).toEqual({ maxRequests: 30, windowSeconds: 60 });
    expect(
      Reflect.getMetadata(
        VIDEO_CALLS_RATE_LIMIT_KEY,
        VideoCallsController.prototype.getExchangeTimer,
      ),
    ).toBeUndefined();
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

      const req = mockReq;
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

      const req = mockReq;
      const result = await controller.startCall(req, { remoteUserId });

      expect(result).toEqual(mockResponse);
      expect(result.e2eeKey).toBe('ephemeral-key');
      expect(result.degraded).toBe(true);
    });

    it('should propagate errors from the service', async () => {
      (videoCallsService.createRoom as Mock).mockRejectedValue(
        new Error('Encrypted calls unavailable'),
      );

      const req = mockReq;

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

      const req = mockReq;
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

      const req = mockReq;

      await expect(controller.acceptCall(req, { roomName })).rejects.toThrow(
        'Call is unavailable',
      );
    });
  });

  describe('exchange timer', () => {
    it('should return the timer state for the authenticated participant', async () => {
      const status = {
        active: true,
        waitingForParticipant: false,
        reciprocal: true,
        roomName,
        turnDurationSeconds: 300,
        turnIndex: 0,
        currentSpeakerId: mockUser.id,
        currentSpeakerLanguage: 'en',
        remainingSeconds: 240,
        isCurrentSpeaker: true,
        participants: [],
      };
      mockExchangeTimerService.getStatus.mockResolvedValue(status);

      const result = await controller.getExchangeTimer(mockReq, roomName);

      expect(mockExchangeTimerService.getStatus).toHaveBeenCalledWith(
        roomName,
        mockUser.id,
      );
      expect(result).toEqual(status);
    });

    it('should advance the turn for the authenticated participant', async () => {
      const status = { active: true, turnIndex: 1 };
      mockExchangeTimerService.advanceTurn.mockResolvedValue(status);

      const result = await controller.advanceExchangeTimer(mockReq, roomName, {
        expectedTurnIndex: 0,
      });

      expect(mockExchangeTimerService.advanceTurn).toHaveBeenCalledWith(
        roomName,
        mockUser.id,
        0,
      );
      expect(result).toEqual(status);
    });

    it('should return inactive timer state when the feature is disabled', async () => {
      const inactive = {
        active: false,
        waitingForParticipant: false,
        reciprocal: false,
        roomName,
        turnDurationSeconds: 300,
        turnIndex: 0,
        currentSpeakerId: null,
        currentSpeakerLanguage: null,
        remainingSeconds: 0,
        isCurrentSpeaker: false,
        participants: [],
      };
      mockExchangeTimerService.getStatus.mockResolvedValue(inactive);

      await expect(
        controller.getExchangeTimer(mockReq, roomName),
      ).resolves.toEqual(inactive);
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
