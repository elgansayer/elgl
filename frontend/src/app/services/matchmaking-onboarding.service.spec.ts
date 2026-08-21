import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatchmakingOnboardingService } from './matchmaking-onboarding.service';

describe('MatchmakingOnboardingService', () => {
  let service: MatchmakingOnboardingService;
  const storageKey = 'hellotalk_matchmaking_onboarding_done';

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);

    TestBed.configureTestingModule({
      providers: [MatchmakingOnboardingService],
    });

    service = TestBed.inject(MatchmakingOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return false for isCompleted when not set', () => {
    expect(service.isCompleted()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should return true for isCompleted after markComplete', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem(storageKey)).toBe('true');
  });

  it('should provide all 8 onboarding steps', () => {
    expect(service.steps.length).toBe(8);
    expect(service.stepNames.length).toBe(8);
  });

  it('should have unique step keys', () => {
    const keys = service.stepNames;
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should have i18n keys for title and text in each step', () => {
    for (const step of service.steps) {
      expect(step.key).toBeTruthy();
      expect(step.title.startsWith('matchmaking.onboarding.')).toBe(true);
      expect(step.text.startsWith('matchmaking.onboarding.')).toBe(true);
    }
  });

  it('should reset tour by removing localStorage entry', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);

    service.reset();
    expect(service.isCompleted()).toBe(false);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it('should set isTourInProgress to false after reset', () => {
    service.reset();
    expect(service.isTourInProgress()).toBe(false);
  });
});