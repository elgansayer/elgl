import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CoinEconomyTourService } from './coin-economy-tour.service';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

describe('CoinEconomyTourService', () => {
  let service: CoinEconomyTourService;
  let joyrideServiceMock: {
    startTour: ReturnType<typeof vi.fn>;
    closeTour: ReturnType<typeof vi.fn>;
    isTourInProgress: ReturnType<typeof vi.fn>;
  };
  let i18nServiceMock: {
    translate: ReturnType<typeof vi.fn>;
  };

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
        CoinEconomyTourService,
        { provide: JoyrideService, useValue: joyrideServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    });

    service = TestBed.inject(CoinEconomyTourService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start a tour when no tour is in progress', () => {
    const tourObservable = of({
      number: 1,
      name: 'tourCoinsBalance',
      route: '/home',
      actionType: 'NEXT',
    });
    joyrideServiceMock.startTour.mockReturnValue(tourObservable);

    const result = service.startTour();
    expect(result).toBe(true);
    expect(joyrideServiceMock.startTour).toHaveBeenCalledOnce();
    const options = joyrideServiceMock.startTour.mock.calls[0][0];
    expect(options.steps).toEqual([
      'tourCoinsBalance',
      'tourShopNav',
      'tourStickerNav',
      'tourVipNav',
      'tourCoinsBuy',
    ]);
    expect(options.themeColor).toBe('#6366f1');
    expect(options.showCounter).toBe(true);
    expect(options.showPrevButton).toBe(true);
    expect(options.customTexts).toBeDefined();
  });

  it('should not start a tour if one is already in progress', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(true);

    const result = service.startTour();
    expect(result).toBe(false);
    expect(joyrideServiceMock.startTour).not.toHaveBeenCalled();
  });

  it('should close the tour', () => {
    service.closeTour();
    expect(joyrideServiceMock.closeTour).toHaveBeenCalledOnce();
  });

  it('should report tour in progress status', () => {
    joyrideServiceMock.isTourInProgress.mockReturnValue(true);
    expect(service.isTourInProgress()).toBe(true);

    joyrideServiceMock.isTourInProgress.mockReturnValue(false);
    expect(service.isTourInProgress()).toBe(false);
  });
});
