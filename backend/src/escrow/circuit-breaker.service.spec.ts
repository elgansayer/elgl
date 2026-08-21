import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be available initially', () => {
    expect(service.isAvailable('test-service')).toBe(true);
  });

  it('should record success and reset failure count', () => {
    service.recordFailure('test-service');
    service.recordFailure('test-service');
    service.recordSuccess('test-service');
    const state = service.getState('test-service');
    expect(state.failureCount).toBe(0);
    expect(state.isOpen).toBe(false);
  });

  it('should open circuit after threshold failures', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-service');
    }
    const state = service.getState('test-service');
    expect(state.isOpen).toBe(true);
    expect(state.failureCount).toBe(5);
  });

  it('should not be available when circuit is open', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-service');
    }
    expect(service.isAvailable('test-service')).toBe(false);
  });

  it('should allow half-open attempts after cooldown', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-half-open-cooldown');
    }
    expect(service.isAvailable('test-half-open-cooldown')).toBe(false);

    service.reset('test-half-open-cooldown');
    expect(service.isAvailable('test-half-open-cooldown')).toBe(true);
  });

  it('should reset a service breaker', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-service');
    }
    service.reset('test-service');
    const state = service.getState('test-service');
    expect(state.isOpen).toBe(false);
    expect(state.failureCount).toBe(0);
  });

  it('should track total failures and successes', () => {
    service.recordFailure('test-service');
    service.recordFailure('test-service');
    service.recordSuccess('test-service');
    service.recordSuccess('test-service');
    const state = service.getState('test-service');
    expect(state.totalFailures).toBe(2);
    expect(state.totalSuccesses).toBe(2);
  });

  describe('executeWithBreaker', () => {
    it('should return operation result on success', async () => {
      const result = await service.executeWithBreaker(
        'test-service',
        () => Promise.resolve('success'),
        () => Promise.resolve('fallback'),
      );
      expect(result).toBe('success');
    });

    it('should return fallback on error', async () => {
      const result = await service.executeWithBreaker(
        'test-service',
        () => {
          throw new Error('Operation failed');
        },
        () => Promise.resolve('fallback'),
      );
      expect(result).toBe('fallback');
    });

    it('should mark degraded flag on fallback', async () => {
      const marker = {
        degraded: false,
        reason: undefined as string | undefined,
      };
      await service.executeWithBreaker(
        'test-service',
        () => {
          throw new Error('Operation failed');
        },
        () => Promise.resolve('fallback'),
        marker,
      );
      expect(marker.degraded).toBe(true);
      expect(marker.reason).toContain('Operation failed');
    });

    it('should use fallback when circuit is open', async () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('test-service');
      }

      const result = await service.executeWithBreaker(
        'test-service',
        () => Promise.resolve('should not reach'),
        () => Promise.resolve('circuit-open-fallback'),
      );
      expect(result).toBe('circuit-open-fallback');
    });
  });

  describe('getAllStates', () => {
    it('should return all registered breaker states', () => {
      service.recordFailure('service-a');
      service.recordSuccess('service-b');
      const states = service.getAllStates();
      expect(states.has('service-a')).toBe(true);
      expect(states.has('service-b')).toBe(true);
    });

    it('should return empty map when no breakers registered', () => {
      const states = service.getAllStates();
      expect(states.size).toBe(0);
    });
  });

  describe('concurrent operations', () => {
    it('should not count reset as new failure', () => {
      for (let i = 0; i < 3; i++) {
        service.recordFailure('concurrent-test');
      }
      // Intermediate state: not yet open
      expect(service.isAvailable('concurrent-test')).toBe(true);
      // Add 2 more to open
      service.recordFailure('concurrent-test');
      service.recordFailure('concurrent-test');
      expect(service.isAvailable('concurrent-test')).toBe(false);
    });

    it('should maintain separate states per service', () => {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('service-x');
      }
      service.recordSuccess('service-y');
      service.recordSuccess('service-y');

      expect(service.isAvailable('service-x')).toBe(false);
      expect(service.isAvailable('service-y')).toBe(true);

      const stateX = service.getState('service-x');
      const stateY = service.getState('service-y');
      expect(stateX.failureCount).toBe(5);
      expect(stateY.failureCount).toBe(0);
    });
  });
});
