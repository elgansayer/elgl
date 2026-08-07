import { TestBed } from '@angular/core/testing';
import { EscrowOnboardingService } from './escrow-onboarding.service';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

describe('EscrowOnboardingService', () => {
  let service: EscrowOnboardingService;
  const mockJoyrideService = {
    isTourInProgress: () => false,
    startTour: () => ({ subscribe: ({ complete }: { complete?: () => void }) => complete?.() }),
  };
  const mockI18nService = {
    translate: (key: string) => key,
    currentLang: { set: () => {}, update: () => {} },
  };

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_escrow_onboarding_done');
    TestBed.configureTestingModule({
      providers: [
        { provide: JoyrideService, useValue: mockJoyrideService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });
    service = TestBed.inject(EscrowOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_escrow_onboarding_done');
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

  it('should have four step names', () => {
    expect(service.stepNames.length).toBe(4);
    expect(service.stepNames).toContain('escrowStepTitle');
    expect(service.stepNames).toContain('escrowStepCreate');
    expect(service.stepNames).toContain('escrowStepFilters');
    expect(service.stepNames).toContain('escrowStepTransactions');
  });

  it('should track isTourInProgress signal', () => {
    expect(service.isTourInProgress()).toBe(false);
    service.isTourInProgress.set(true);
    expect(service.isTourInProgress()).toBe(true);
    service.isTourInProgress.set(false);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem('hellotalk_escrow_onboarding_done')).toBe('true');
  });

  it('should reset tour by removing localStorage item and setting isTourInProgress to false', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    service.resetTour();
    expect(service.isCompleted()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
    expect(window.localStorage.getItem('hellotalk_escrow_onboarding_done')).toBeNull();
  });

  it('should allow replaying the tour after reset', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    service.resetTour();
    expect(service.isCompleted()).toBe(false);
    service.isTourInProgress.set(true);
    expect(service.isTourInProgress()).toBe(true);
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });
});