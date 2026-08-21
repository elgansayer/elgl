import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DiscoveryOnboardingService } from './discovery-onboarding.service';

describe('DiscoveryOnboardingService', () => {
  let service: DiscoveryOnboardingService;

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_discovery_onboarding_done');

    TestBed.configureTestingModule({
      providers: [DiscoveryOnboardingService],
    });

    service = TestBed.inject(DiscoveryOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_discovery_onboarding_done');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false for isCompleted / hasCompletedTour when not set', () => {
    expect(service.isCompleted()).toBe(false);
    expect(service.hasCompletedTour()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should return true for isCompleted after markComplete', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    expect(service.hasCompletedTour()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem('hellotalk_discovery_onboarding_done')).toBe('true');
  });

  it('should mark tour complete immediately when startTour is called', () => {
    service.startTour();
    expect(service.isCompleted()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should reset tour by removing localStorage entry', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);

    service.resetTour();
    expect(service.isCompleted()).toBe(false);
    expect(window.localStorage.getItem('hellotalk_discovery_onboarding_done')).toBeNull();
  });
});
