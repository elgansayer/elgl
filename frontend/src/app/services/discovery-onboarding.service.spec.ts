import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DiscoveryOnboardingService } from './discovery-onboarding.service';
import { I18nService } from './i18n.service';
import { JoyrideService } from 'ngx-joyride';

describe('DiscoveryOnboardingService', () => {
  let service: DiscoveryOnboardingService;
  let joyrideServiceMock: { startTour: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof vi.fn> };
  let i18nServiceMock: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_discovery_onboarding_done');

    joyrideServiceMock = {
      startTour: vi.fn(),
      isTourInProgress: vi.fn().mockReturnValue(false),
    };
    i18nServiceMock = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    TestBed.configureTestingModule({
      providers: [
        DiscoveryOnboardingService,
        { provide: JoyrideService, useValue: joyrideServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    });

    service = TestBed.inject(DiscoveryOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_discovery_onboarding_done');
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

  it('should have seven step names', () => {
    expect(service.stepNames.length).toBe(7);
    expect(service.stepNames).toContain('discoveryStepTitle');
    expect(service.stepNames).toContain('discoveryStepFilterPills');
    expect(service.stepNames).toContain('discoveryStepLanguagePills');
    expect(service.stepNames).toContain('discoveryStepSortGender');
    expect(service.stepNames).toContain('discoveryStepAgeDistance');
    expect(service.stepNames).toContain('discoveryStepGlobalSearch');
    expect(service.stepNames).toContain('discoveryStepPartnerCards');
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem('hellotalk_discovery_onboarding_done')).toBe('true');
  });

  it('should not start tour if one is already in progress', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(true);

    service.startTour();

    expect(joyrideServiceMock.startTour).not.toHaveBeenCalled();
  });

  it('should start tour with correct steps for discovery feature', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(false);
    const tourSubject = new Subject<void>();
    joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

    service.startTour();

    expect(joyrideServiceMock.startTour).toHaveBeenCalledTimes(1);

    const options = joyrideServiceMock.startTour.mock.calls[0][0];
    expect(options).toBeDefined();
    expect(options.steps).toBeDefined();
    expect(Array.isArray(options.steps)).toBe(true);

    const steps = options.steps as string[];
    expect(steps.length).toBe(7);
    expect(steps).toContain('discoveryStepTitle');
    expect(steps).toContain('discoveryStepFilterPills');
    expect(steps).toContain('discoveryStepLanguagePills');
    expect(steps).toContain('discoveryStepSortGender');
    expect(steps).toContain('discoveryStepAgeDistance');
    expect(steps).toContain('discoveryStepGlobalSearch');
    expect(steps).toContain('discoveryStepPartnerCards');

    expect(options.stepDefaultPosition).toBe('bottom');
    expect(options.themeColor).toBe('#6366f1');
    expect(options.showCounter).toBe(true);
    expect(options.showPrevButton).toBe(true);
  });

  it('should handle tour errors gracefully', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(false);
    const tourSubject = new Subject<void>();
    joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

    service.startTour();

    // Should not throw when error is emitted
    expect(() => tourSubject.error(new Error('Tour error'))).not.toThrow();
  });

  it('should mark complete when tour completes', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(false);
    const tourSubject = new Subject<void>();
    joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

    service.startTour();

    tourSubject.complete();
    expect(service.isCompleted()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });
});