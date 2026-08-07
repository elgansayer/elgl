import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { Subject } from 'rxjs';
import { TourService } from './tour.service';
import { I18nService } from './i18n.service';
import { JoyrideService } from 'ngx-joyride';

describe('TourService', () => {
  let service: TourService;
  let joyrideServiceMock: { startTour: ReturnType<typeof vi.fn>; closeTour: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof vi.fn> };
  let i18nServiceMock: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    joyrideServiceMock = {
      startTour: vi.fn(),
      closeTour: vi.fn(),
      isTourInProgress: vi.fn().mockReturnValue(false),
    };
    i18nServiceMock = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    TestBed.configureTestingModule({
      providers: [
        TourService,
        { provide: JoyrideService, useValue: joyrideServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(TourService);

    // Clear localStorage before each test
    try { localStorage.removeItem('ht_video_classroom_tour_done'); } catch { /* noop */ }
  });

  afterEach(() => {
    try { localStorage.removeItem('ht_video_classroom_tour_done'); } catch { /* noop */ }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('economy tour', () => {
    it('should not start tour if one is already in progress', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(true);

      service.startEconomyTour();

      expect(joyrideServiceMock.startTour).not.toHaveBeenCalled();
    });

    it('should start tour with correct steps for economy feature', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(false);
      const tourSubject = new Subject();
      joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

      service.startEconomyTour();

      expect(joyrideServiceMock.startTour).toHaveBeenCalledTimes(1);

      const options = joyrideServiceMock.startTour.mock.calls[0][0];
      expect(options).toBeDefined();
      expect(options.steps).toBeDefined();
      expect(Array.isArray(options.steps)).toBe(true);

      const steps = options.steps as string[];
      expect(steps).toContain('economyTour@coinsBalance');
      expect(steps).toContain('economyTour@shopLink');
      expect(steps).toContain('economyTour@stickerStore');
      expect(steps).toContain('economyTour@vipLink');
      expect(steps).toContain('economyTour@cartLink');
      expect(steps.length).toBe(5);

      expect(options.stepDefaultPosition).toBe('bottom');
      expect(options.themeColor).toBe('#6366f1');
      expect(options.showCounter).toBe(true);
      expect(options.showPrevButton).toBe(true);
    });

    it('should handle tour errors gracefully', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(false);
      const tourSubject = new Subject();
      joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

      service.startEconomyTour();

      expect(() => tourSubject.error(new Error('Tour error'))).not.toThrow();
    });
  });

  describe('video classroom tour', () => {
    it('should have correct step names', () => {
      const steps = service.videoClassroomTourSteps;
      expect(steps).toContain('videoClassroomTour@marketplace');
      expect(steps).toContain('videoClassroomTour@roomHeader');
      expect(steps).toContain('videoClassroomTour@hostVideo');
      expect(steps).toContain('videoClassroomTour@coHostInvite');
      expect(steps).toContain('videoClassroomTour@liveChat');
      expect(steps.length).toBe(5);
    });

    it('should not start if a tour is already in progress', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(true);

      service.startVideoClassroomTour();

      expect(joyrideServiceMock.startTour).not.toHaveBeenCalled();
    });

    it('should start video classroom tour with correct options', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(false);
      const tourSubject = new Subject();
      joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

      service.startVideoClassroomTour();

      expect(joyrideServiceMock.startTour).toHaveBeenCalledTimes(1);

      const options = joyrideServiceMock.startTour.mock.calls[0][0];
      expect(options.steps).toEqual(service.videoClassroomTourSteps);
      expect(options.stepDefaultPosition).toBe('bottom');
      expect(options.themeColor).toBe('#6366f1');
      expect(options.showCounter).toBe(true);
      expect(options.showPrevButton).toBe(true);
    });

    it('should mark tour done on complete', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(false);
      const tourSubject = new Subject();
      joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

      service.startVideoClassroomTour();
      expect(service.isVideoClassroomTourDone()).toBe(false);

      tourSubject.complete();

      expect(service.isVideoClassroomTourDone()).toBe(true);
    });

    it('should handle tour errors gracefully', () => {
      joyrideServiceMock.isTourInProgress.mockReturnValue(false);
      const tourSubject = new Subject();
      joyrideServiceMock.startTour.mockReturnValue(tourSubject.asObservable());

      service.startVideoClassroomTour();

      expect(() => tourSubject.error(new Error('Tour error'))).not.toThrow();
    });

    it('should reset tour flag', () => {
      service.markVideoClassroomTourDone();
      expect(service.isVideoClassroomTourDone()).toBe(true);

      service.resetVideoClassroomTour();
      expect(service.isVideoClassroomTourDone()).toBe(false);
    });
  });
});