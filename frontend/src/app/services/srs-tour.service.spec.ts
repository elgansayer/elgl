import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { JoyrideService } from 'ngx-joyride';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { I18nService } from './i18n.service';
import { SRS_TOUR_STEPS, SrsTourService } from './srs-tour.service';

const STORAGE_KEY = 'hellotalk_srs_tour_completed';

describe('SrsTourService', () => {
  let service: SrsTourService;
  let tourSteps: Subject<unknown>;
  let joyride: { startTour: Mock; isTourInProgress: Mock; closeTour: Mock };
  let router: { navigate: Mock };

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.removeItem(STORAGE_KEY);
    tourSteps = new Subject();
    joyride = {
      startTour: vi.fn().mockReturnValue(tourSteps),
      isTourInProgress: vi.fn().mockReturnValue(false),
      closeTour: vi.fn(),
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        SrsTourService,
        { provide: JoyrideService, useValue: joyride },
        { provide: Router, useValue: router },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    service = TestBed.inject(SrsTourService);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem(STORAGE_KEY);
  });

  /** Runs the navigation and the anchor settle delay, leaving the tour running. */
  async function runUntilTourStarts(): Promise<void> {
    await vi.advanceTimersByTimeAsync(500);
  }

  it('starts unseen', () => {
    expect(service.hasCompletedTour()).toBe(false);
  });

  it('navigates to the vocabulary page, waits for its anchors, then starts the tour', async () => {
    const started = service.startTour();

    await vi.advanceTimersByTimeAsync(0);
    expect(router.navigate).toHaveBeenCalledWith(['/vocabulary']);
    expect(joyride.startTour).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(joyride.startTour).toHaveBeenCalledOnce();
    const options = joyride.startTour.mock.calls[0][0];
    expect(options.steps).toEqual([...SRS_TOUR_STEPS]);
    expect(options.startWith).toBe(SRS_TOUR_STEPS[0]);
    expect(options.customTexts.next).toBe('srsTour.nextBtn');

    tourSteps.complete();
    await started;
  });

  it('marks the tour as seen once it completes', async () => {
    const started = service.startTour();
    await runUntilTourStarts();
    expect(service.hasCompletedTour()).toBe(false);

    tourSteps.complete();
    await started;

    expect(service.hasCompletedTour()).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('marks the tour as seen when it errors because a step anchor is missing', async () => {
    const started = service.startTour();
    await runUntilTourStarts();

    tourSteps.error(new Error('step anchor not found'));
    await started;

    expect(service.hasCompletedTour()).toBe(true);
  });

  it('holds exactly one observer on the tour stream while running and none afterwards', async () => {
    const started = service.startTour();
    await runUntilTourStarts();
    expect(tourSteps.observed).toBe(true);

    tourSteps.complete();
    await started;

    expect(tourSteps.observed).toBe(false);
  });

  it('ignores a second click while the first request is still pending', async () => {
    const first = service.startTour();
    const second = service.startTour();
    await runUntilTourStarts();

    tourSteps.complete();
    await Promise.all([first, second]);

    expect(router.navigate).toHaveBeenCalledOnce();
    expect(joyride.startTour).toHaveBeenCalledOnce();
  });

  it('does nothing while joyride already has a tour running', async () => {
    joyride.isTourInProgress.mockReturnValue(true);

    await service.startTour();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(joyride.startTour).not.toHaveBeenCalled();
  });

  it('can start again once the previous tour has ended', async () => {
    const secondRun = new Subject<unknown>();
    joyride.startTour.mockReturnValueOnce(tourSteps).mockReturnValueOnce(secondRun);

    const first = service.startTour();
    await runUntilTourStarts();
    tourSteps.complete();
    await first;

    const second = service.startTour();
    await runUntilTourStarts();
    secondRun.complete();
    await second;

    expect(joyride.startTour).toHaveBeenCalledTimes(2);
  });

  it('neither starts the tour nor marks it seen when navigation fails', async () => {
    router.navigate.mockRejectedValue(new Error('navigation blocked'));

    const started = service.startTour();
    await vi.advanceTimersByTimeAsync(500);
    await started;

    expect(joyride.startTour).not.toHaveBeenCalled();
    expect(service.hasCompletedTour()).toBe(false);
  });

  it('allows a retry after a failed navigation', async () => {
    router.navigate.mockRejectedValueOnce(new Error('navigation blocked'));
    await service.startTour();

    const retry = service.startTour();
    await runUntilTourStarts();
    tourSteps.complete();
    await retry;

    expect(joyride.startTour).toHaveBeenCalledOnce();
    expect(service.hasCompletedTour()).toBe(true);
  });
});
