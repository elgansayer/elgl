/// <reference types="vi" />
import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DiscoveryDegradationService', () => {
  let service: DiscoveryDegradationService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      lpush: vi.fn().mockResolvedValue(1),
      ltrim: vi.fn().mockResolvedValue('OK'),
      lrange: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryDegradationService,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<DiscoveryDegradationService>(
      DiscoveryDegradationService,
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
      expect(service.isAvailable('supabase')).toBe(true);
    });

    it('should return true when failures are below threshold', () => {
      for (let i = 0; i < 4; i++) {
        service.recordFailure('supabase');
      }
      expect(service.isAvailable('supabase')).toBe(true);
    });

    it('should return false when circuit is open', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }
      expect(service.isAvailable('supabase')).toBe(false);
    });

    it('should allow half-open attempts after cooldown', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }
      const state = service.getAllBreakerStates().get('supabase')!;
      state.cooldownUntil = Date.now() - 1;
      service.recordFailure('supabase');

      expect(service.isAvailable('supabase')).toBe(true);
    });

    it('should reject after max half-open attempts', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }
      const state = service.getAllBreakerStates().get('supabase')!;
      state.cooldownUntil = Date.now() - 1;

      for (let i = 0; i < 3; i++) {
        service.isAvailable('supabase');
      }

      expect(service.isAvailable('supabase')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Circuit breaker: recordSuccess / recordFailure
  // ---------------------------------------------------------------------------
  describe('recordSuccess', () => {
    it('should close an open circuit on success', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }
      expect(service.isAvailable('supabase')).toBe(false);

      const state = service.getAllBreakerStates().get('supabase')!;
      state.cooldownUntil = Date.now() - 1;
      service.isAvailable('supabase');
      service.recordSuccess('supabase');

      expect(service.isAvailable('supabase')).toBe(true);
    });

    it('should reset failure count on success when circuit is closed', () => {
      service.recordFailure('supabase');
      service.recordFailure('supabase');
      service.recordSuccess('supabase');

      const state = service.getAllBreakerStates().get('supabase')!;
      expect(state.failureCount).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      service.recordFailure('supabase');
      const state = service.getAllBreakerStates().get('supabase')!;
      expect(state.failureCount).toBe(1);
      expect(state.totalFailures).toBe(1);
    });

    it('should open circuit after threshold reached', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }
      const state = service.getAllBreakerStates().get('supabase')!;
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
        'supabase',
        operation,
        fallback,
        marker,
      );

      expect(result).toBe('success');
      expect(marker.degraded).toBe(false);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use fallback when operation fails', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('DB down'));
      const fallback = vi.fn().mockResolvedValue('fallback');
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
        fallbackSource: 'none' as const,
      };

      const result = await service.executeWithBreaker(
        'supabase',
        operation,
        fallback,
        marker,
      );

      expect(result).toBe('fallback');
      expect(marker.degraded).toBe(true);
      expect(marker.reason).toContain('DB down');
      expect(marker.fallbackSource).toBe('basic_query');
    });

    it('should use fallback when circuit is open', async () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('supabase');
      }

      const operation = vi.fn().mockResolvedValue('primary');
      const fallback = vi.fn().mockResolvedValue('fallback');
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
        fallbackSource: 'none' as const,
      };

      const result = await service.executeWithBreaker(
        'supabase',
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
  // executeWithCascade
  // ---------------------------------------------------------------------------
  describe('executeWithCascade', () => {
    it('should return primary result when available', async () => {
      const primary = vi.fn().mockResolvedValue(['primary']);
      const secondary = vi.fn();
      const ultimate = vi.fn();

      const result = await service.executeWithCascade(
        'supabase',
        primary,
        secondary,
        ultimate,
      );

      expect(result.data).toEqual(['primary']);
      expect(result.marker.degraded).toBe(false);
      expect(secondary).not.toHaveBeenCalled();
      expect(ultimate).not.toHaveBeenCalled();
    });

    it('should fall through secondary to mock when secondary returns empty', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('DB down'));
      const secondary = vi.fn().mockResolvedValue([]);
      const ultimate = vi.fn().mockResolvedValue(['mock']);

      const result = await service.executeWithCascade(
        'supabase',
        primary,
        secondary,
        ultimate,
      );

      expect(result.data).toEqual(['mock']);
      expect(result.marker.degraded).toBe(true);
      expect(result.marker.fallbackSource).toBe('mock');
      expect(secondary).toHaveBeenCalled();
      expect(ultimate).toHaveBeenCalled();
    });

    it('should use secondary results when primary fails and secondary has data', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('RPC error'));
      const secondary = vi.fn().mockResolvedValue(['secondary']);
      const ultimate = vi.fn();

      const result = await service.executeWithCascade(
        'supabase',
        primary,
        secondary,
        ultimate,
      );

      expect(result.data).toEqual(['secondary']);
      expect(result.marker.degraded).toBe(true);
      expect(result.marker.fallbackSource).toBe('basic_query');
      expect(ultimate).not.toHaveBeenCalled();
    });

    it('should use ultimate fallback when secondary also fails', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('RPC error'));
      const secondary = vi.fn().mockRejectedValue(new Error('DB error'));
      const ultimate = vi.fn().mockResolvedValue(['mock']);

      const result = await service.executeWithCascade(
        'supabase',
        primary,
        secondary,
        ultimate,
      );

      expect(result.data).toEqual(['mock']);
      expect(result.marker.degraded).toBe(true);
      expect(result.marker.fallbackSource).toBe('mock');
    });
  });

  // ---------------------------------------------------------------------------
  // Degradation event logging
  // ---------------------------------------------------------------------------
  describe('recordDegradationEvent', () => {
    it('should push event to Redis with ltrim', async () => {
      await service.recordDegradationEvent(
        '/discovery/partners',
        'Circuit open',
        'mock',
        'user-1',
      );

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        'discovery:degradation_events',
        expect.stringContaining('user-1'),
      );
      expect(mockRedisClient.ltrim).toHaveBeenCalledWith(
        'discovery:degradation_events',
        0,
        499,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.lpush.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.recordDegradationEvent('/discovery/partners', 'error', 'mock'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getRecentDegradationEvents', () => {
    it('should parse and return recent events', async () => {
      const event = JSON.stringify({
        endpoint: '/discovery/partners',
        reason: 'test',
        fallbackSource: 'mock',
        userId: 'u1',
        timestamp: new Date().toISOString(),
      });
      mockRedisClient.lrange.mockResolvedValue([event]);

      const results = await service.getRecentDegradationEvents();

      expect(results).toHaveLength(1);
      expect(results[0].endpoint).toBe('/discovery/partners');
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
    it('should clear all breaker state', () => {
      service.recordFailure('supabase');
      service.recordFailure('redis');
      expect(service.getAllBreakerStates().size).toBe(2);

      service.resetAllBreakers();

      expect(service.getAllBreakerStates().size).toBe(0);
    });
  });
});
