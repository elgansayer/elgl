import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LingqOnboardingService } from './lingq-onboarding.service';

describe('LingqOnboardingService', () => {
  let service: LingqOnboardingService;

  beforeEach(() => {
    localStorage.clear();
    service = new LingqOnboardingService();
  });

  it('should be created with isTourInProgress false', () => {
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should expose three tour steps', () => {
    expect(service.steps.length).toBe(3);
    expect(service.steps[0].key).toBe('lingqStepTitle');
    expect(service.steps[1].key).toBe('lingqStepPlayback');
    expect(service.steps[2].key).toBe('lingqStepTokens');
  });

  it('should return step names in order', () => {
    const names = service.stepNames;
    expect(names).toEqual(['lingqStepTitle', 'lingqStepPlayback', 'lingqStepTokens']);
  });

  it('should mark tour as not completed initially', () => {
    expect(service.isCompleted()).toBe(false);
  });

  it('should persist completion status to localStorage', () => {
    service.markComplete();
    expect(service.isTourInProgress()).toBe(false);
    expect(service.isCompleted()).toBe(true);
    expect(localStorage.getItem('hellotalk_lingq_onboarding_done')).toBe('true');
  });

  it('should handle localStorage unavailability gracefully during markComplete', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });
    service.markComplete();
    expect(service.isTourInProgress()).toBe(false);
    setItemSpy.mockRestore();
  });

  it('should handle localStorage unavailability gracefully during isCompleted', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    expect(service.isCompleted()).toBe(false);
    getItemSpy.mockRestore();
  });
});