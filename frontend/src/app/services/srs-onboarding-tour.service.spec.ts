import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { SrsOnboardingTourService } from './srs-onboarding-tour.service';
import { JoyrideService } from 'ngx-joyride';

describe('SrsOnboardingTourService', () => {
  let service: SrsOnboardingTourService;
  let mockJoyrideService: {
    startTour: ReturnType<typeof vi.fn>;
    closeTour: ReturnType<typeof vi.fn>;
    isTourInProgress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    mockJoyrideService = {
      startTour: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
      closeTour: vi.fn(),
      isTourInProgress: vi.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      providers: [
        SrsOnboardingTourService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: JoyrideService, useValue: mockJoyrideService },
      ],
    });

    service = TestBed.inject(SrsOnboardingTourService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should not be in progress initially', () => {
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should not have completed tour by default', () => {
    expect(service.hasCompletedTour()).toBe(false);
  });

  it('should reset tour completion state', () => {
    service.resetTour();
    expect(service.hasCompletedTour()).toBe(false);
    expect(localStorage.getItem('srs_onboarding_tour_completed')).toBeNull();
  });

  it('should call closeTour on joyride service', () => {
    service.closeTour();
    expect(mockJoyrideService.closeTour).toHaveBeenCalled();
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should call joyrideService.startTour when startTour is called', () => {
    service.startTour();
    expect(mockJoyrideService.startTour).toHaveBeenCalled();
  });

  it('should not call joyrideService.startTour if already in progress', () => {
    service.isTourInProgress.set(true);
    service.startTour();
    expect(mockJoyrideService.startTour).not.toHaveBeenCalled();
  });
});