import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationOnboardingService } from './moderation-onboarding.service';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from '../services/i18n.service';
import { of } from 'rxjs';

describe('ModerationOnboardingService', () => {
  let service: ModerationOnboardingService;
  let joyrideServiceMock: ReturnType<typeof createJoyrideMock>;
  let i18nServiceMock: ReturnType<typeof createI18nMock>;

  function createJoyrideMock() {
    return {
      startTour: vi.fn().mockReturnValue(of({ number: 1, name: 'test' })),
      closeTour: vi.fn(),
      isTourInProgress: vi.fn().mockReturnValue(false),
    };
  }

  function createI18nMock() {
    return {
      translate: vi.fn().mockImplementation((key: string) => {
        const parts = key.split('.');
        return `[${parts[parts.length - 1]}]`;
      }),
    };
  }

  beforeEach(() => {
    joyrideServiceMock = createJoyrideMock();
    i18nServiceMock = createI18nMock();

    TestBed.configureTestingModule({
      providers: [
        ModerationOnboardingService,
        { provide: JoyrideService, useValue: joyrideServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    });

    service = TestBed.inject(ModerationOnboardingService);
  });

  it('creates the service', () => {
    expect(service).toBeTruthy();
  });

  it('exposes four step keys', () => {
    expect(service.stepKeys.length).toBe(4);
    expect(service.stepKeys).toContain('stepTypeTabs');
    expect(service.stepKeys).toContain('stepStatusFilters');
    expect(service.stepKeys).toContain('stepReportedItems');
    expect(service.stepKeys).toContain('stepApproveReject');
  });

  it('getSteps returns translated step descriptions', () => {
    const steps = service.getSteps();
    expect(steps.length).toBe(4);
    expect(i18nServiceMock.translate).toHaveBeenCalled();
    steps.forEach((step) => {
      expect(step.key).toBeDefined();
      expect(step.title).toBeDefined();
      expect(step.text).toBeDefined();
    });
  });

  it('startTour calls joyrideService.startTour with correct options', () => {
    service.startTour();
    expect(joyrideServiceMock.startTour).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: service.stepKeys,
        themeColor: '#1d4ed8',
        showCounter: true,
        showPrevButton: true,
      }),
    );
  });

  it('closeTour calls joyrideService.closeTour when tour is in progress', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(true);
    service.closeTour();
    expect(joyrideServiceMock.closeTour).toHaveBeenCalled();
  });

  it('closeTour does not call joyrideService.closeTour when tour is not in progress', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(false);
    service.closeTour();
    expect(joyrideServiceMock.closeTour).not.toHaveBeenCalled();
  });
});