import { describe, beforeEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SrsCircuitBreakerService } from './srs-circuit-breaker.service';

describe('SrsCircuitBreakerService', () => {
  let service: SrsCircuitBreakerService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [SrsCircuitBreakerService],
    });
    service = TestBed.inject(SrsCircuitBreakerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be available by default', () => {
    expect(service.isAvailable('srs-flashcards-list')).toBe(true);
  });

  it('should record success and stay available', () => {
    service.recordSuccess('srs-flashcards-list');
    expect(service.isAvailable('srs-flashcards-list')).toBe(true);
  });

  it('should not open circuit below threshold', () => {
    for (let i = 0; i < 4; i++) {
      service.recordFailure('srs-flashcards-list');
    }
    expect(service.isAvailable('srs-flashcards-list')).toBe(true);
  });

  it('should open circuit after reaching failure threshold', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('srs-flashcards-list');
    }
    expect(service.isAvailable('srs-flashcards-list')).toBe(false);
  });

  it('should recover circuit after reset', () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('srs-flashcards-list');
    }
    expect(service.isAvailable('srs-flashcards-list')).toBe(false);
    service.reset('srs-flashcards-list');
    expect(service.isAvailable('srs-flashcards-list')).toBe(true);
  });

  it('should execute operation and return result via circuit breaker', async () => {
    const result = await service.executeWithBreaker(
      'test-service',
      async () => 'success',
      async () => 'fallback',
    );
    expect(result).toBe('success');
  });

  it('should return fallback when circuit is open', async () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-service');
    }
    const result = await service.executeWithBreaker(
      'test-service',
      async () => 'success',
      async () => 'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('should return fallback on operation failure', async () => {
    const result = await service.executeWithBreaker(
      'test-service',
      async () => { throw new Error('Boom'); },
      async () => 'fallback',
    );
    expect(result).toBe('fallback');
  });

  it('should set degraded marker on fallback', async () => {
    for (let i = 0; i < 5; i++) {
      service.recordFailure('test-service');
    }
    const degraded = { degraded: false, reason: '' };
    await service.executeWithBreaker(
      'test-service',
      async () => 'success',
      async () => 'fallback',
      degraded,
    );
    expect(degraded.degraded).toBe(true);
    expect(degraded.reason).toContain('Circuit breaker open');
  });

  it('should get state', () => {
    const state = service.getState('test-service');
    expect(state.isOpen).toBe(false);
    expect(state.failureCount).toBe(0);
  });

  it('should reset state', () => {
    service.recordFailure('test-service');
    service.reset('test-service');
    const state = service.getState('test-service');
    expect(state.failureCount).toBe(0);
    expect(state.totalFailures).toBe(0);
  });
});
