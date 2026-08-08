import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { SrsOnboardingTourService } from './srs-onboarding-tour.service';

describe('SrsOnboardingTourService', () => {
  let service: SrsOnboardingTourService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        SrsOnboardingTourService,
        { provide: PLATFORM_ID, useValue: 'browser' },
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

  it('should have not completed tour by default', () => {
    expect(service.hasCompletedTour()).toBe(false);
  });

  it('should reset tour completion state', () => {
    service.resetTour();
    expect(service.hasCompletedTour()).toBe(false);
    expect(localStorage.getItem('srs_onboarding_tour_completed')).toBeFalsy();
  });

  it('should mark tour complete on close', () => {
    service.closeTour();
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should mark tour complete on start', () => {
    service.startTour();
    // Tour is disabled so it marks complete immediately
    expect(service.hasCompletedTour()).toBe(true);
  });

  it('should mark tour complete even if already in progress', () => {
    service.isTourInProgress.set(true);
    service.startTour();
    expect(service.hasCompletedTour()).toBe(true);
  });
});