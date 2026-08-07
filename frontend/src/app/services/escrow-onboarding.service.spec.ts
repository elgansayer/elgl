import { TestBed } from '@angular/core/testing';
import { EscrowOnboardingService } from './escrow-onboarding.service';

describe('EscrowOnboardingService', () => {
  let service: EscrowOnboardingService;

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_escrow_onboarding_done');
    TestBed.configureTestingModule({});
    service = TestBed.inject(EscrowOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_escrow_onboarding_done');
  });

  it('should return false for isCompleted when not set', () => {
    expect(service.isCompleted()).toBeFalse();
    expect(service.isTourInProgress()).toBeFalse();
  });

  it('should return true for isCompleted after markComplete', () => {
    service.markComplete();
    expect(service.isCompleted()).toBeTrue();
    expect(service.isTourInProgress()).toBeFalse();
  });

  it('should have four step names', () => {
    expect(service.stepNames.length).toBe(4);
    expect(service.stepNames).toContain('escrowStepTitle');
    expect(service.stepNames).toContain('escrowStepCreate');
    expect(service.stepNames).toContain('escrowStepFilters');
    expect(service.stepNames).toContain('escrowStepTransactions');
  });

  it('should track isTourInProgress signal', () => {
    expect(service.isTourInProgress()).toBeFalse();
    service.isTourInProgress.set(true);
    expect(service.isTourInProgress()).toBeTrue();
    service.isTourInProgress.set(false);
    expect(service.isTourInProgress()).toBeFalse();
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem('hellotalk_escrow_onboarding_done')).toBe('true');
  });
});