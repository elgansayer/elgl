/// <reference types="vi" />
import { Test, TestingModule } from '@nestjs/testing';
import { VideoCallsDegradationService } from './video-calls-degradation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('VideoCallsDegradationService', () => {
  let service: VideoCallsDegradationService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      lpush: vi.fn().mockResolvedValue(1),
      ltrim: vi.fn().mockResolvedValue('OK'),
      lrange: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoCallsDegradationService,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<VideoCallsDegradationService>(
      VideoCallsDegradationService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Circuit breaker: availability
  // ---------------------------------------------------------------------------
  describe('isAvailable', () => {
    it('should return true when no failures recorded', () => {
      expect(service.isAvailable('livekit')).toBe(true);
    });

    it('should return true when failures are below threshold', () => {
      service.recordFailure('livekit');
      service.recordFailure('livekit');
      expect(service.isAvailable('livekit')).toBe(true);
    });

    it('should return false when circuit is open', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }
      expect(service.isAvailable('livekit')).toBe(false);
    });

    it('should allow half-open attempts after cooldown', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }
      const state = service.getAllBreakerStates().get('livekit')!;
      state.cooldownUntil = Date.now() - 1;
      expect(service.isAvailable('livekit')).toBe(true);
    });

    it('should reject after max half-open attempts', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }
      const state = service.getAllBreakerStates().get('livekit')!;
      state.cooldownUntil = Date.now() - 1;

      for (let i = 0; i < 2; i++) {
        service.isAvailable('livekit');
      }
      expect(service.isAvailable('livekit')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Circuit breaker: recordSuccess / recordFailure
  // ---------------------------------------------------------------------------
  describe('recordSuccess', () => {
    it('should close an open circuit on success', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }
      expect(service.isAvailable('livekit')).toBe(false);

      const state = service.getAllBreakerStates().get('livekit')!;
      state.cooldownUntil = Date.now() - 1;
      service.isAvailable('livekit');
      service.recordSuccess('livekit');

      expect(service.isAvailable('livekit')).toBe(true);
    });

    it('should reset failure count on success when circuit is closed', () => {
      service.recordFailure('livekit');
      service.recordFailure('livekit');
      service.recordSuccess('livekit');

      const state = service.getAllBreakerStates().get('livekit')!;
      expect(state.failureCount).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      service.recordFailure('livekit');
      const state = service.getAllBreakerStates().get('livekit')!;
      expect(state.failureCount).toBe(1);
      expect(state.totalFailures).toBe(1);
    });

    it('should open circuit after threshold reached', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }
      const state = service.getAllBreakerStates().get('livekit')!;
      expect(state.isOpen).toBe(true);
      expect(state.cooldownUntil).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // executeWithBreaker
  // ---------------------------------------------------------------------------
  describe('executeWithBreaker', () => {
    it('should return operation result when successful', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const fallback = vi.fn().mockResolvedValue('fallback');
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
        fallbackSource: 'none' as const,
      };

      const result = await service.executeWithBreaker(
        'livekit',
        operation,
        fallback,
        marker,
      );

      expect(result).toBe('success');
      expect(marker.degraded).toBe(false);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use fallback when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('LiveKit down'));
      const fallback = vi.fn().mockResolvedValue('fallback');
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
        fallbackSource: 'none' as const,
      };

      const result = await service.executeWithBreaker(
        'livekit',
        operation,
        fallback,
        marker,
      );

      expect(result).toBe('fallback');
      expect(marker.degraded).toBe(true);
      expect(marker.reason).toContain('LiveKit down');
      expect(marker.fallbackSource).toBe('standalone');
    });

    it('should use fallback when circuit is open', async () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('livekit');
      }

      const operation = vi.fn().mockResolvedValue('primary');
      const fallback = vi.fn().mockResolvedValue('fallback');
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
        fallbackSource: 'none' as const,
      };

      const result = await service.executeWithBreaker(
        'livekit',
        operation,
        fallback,
        marker,
      );

      expect(result).toBe('fallback');
      expect(marker.degraded).toBe(true);
      expect(marker.fallbackSource).toBe('cache');
      expect(operation).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Token cache
  // ---------------------------------------------------------------------------
  describe('token cache', () => {
    it('should cache and retrieve a token', () => {
      service.cacheToken('room1', 'user1', 'test-token');
      expect(service.getCachedToken('room1', 'user1')).toBe('test-token');
    });

    it('should return null for non-existing token', () => {
      expect(service.getCachedToken('nonexistent', 'user1')).toBeNull();
    });

    it('should return null for expired token', () => {
      service.cacheToken('room1', 'user1', 'test-token');
      // Force expiry by manipulating the internal cache
      const key = 'room1:user1';
      const entry = (service as any).tokenCache.get(key);
      entry.expiresAt = Date.now() - 1000;
      expect(service.getCachedToken('room1', 'user1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Degradation event logging
  // ---------------------------------------------------------------------------
  describe('recordDegradationEvent', () => {
    it('should push event to Redis with ltrim', async () => {
      await service.recordDegradationEvent(
        '/video-calls/start',
        'Circuit open',
        'standalone',
        'user-1',
      );

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        'video-calls:degradation_events',
        expect.stringContaining('user-1'),
      );
      expect(mockRedisClient.ltrim).toHaveBeenCalledWith(
        'video-calls:degradation_events',
        0,
        499,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.lpush.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.recordDegradationEvent(
          '/video-calls/start',
          'error',
          'standalone',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getRecentDegradationEvents', () => {
    it('should parse and return recent events', async () => {
      const event = JSON.stringify({
        endpoint: '/video-calls/start',
        reason: 'test',
        fallbackSource: 'standalone',
        userId: 'u1',
        timestamp: new Date().toISOString(),
      });
      mockRedisClient.lrange.mockResolvedValue([event]);

      const results = await service.getRecentDegradationEvents();

      expect(results).toHaveLength(1);
      expect(results[0].endpoint).toBe('/video-calls/start');
    });

    it('should return empty array on Redis error', async () => {
      mockRedisClient.lrange.mockRejectedValue(new Error('Redis down'));

      const results = await service.getRecentDegradationEvents();

      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // resetAllBreakers
  // ---------------------------------------------------------------------------
  describe('resetAllBreakers', () => {
    it('should clear all breaker state and token cache', () => {
      service.recordFailure('livekit');
      service.cacheToken('room1', 'user1', 'test-token');
      expect(service.getAllBreakerStates().size).toBe(1);

      service.resetAllBreakers();

      expect(service.getAllBreakerStates().size).toBe(0);
      expect(service.getCachedToken('room1', 'user1')).toBeNull();
    });
  });
});
