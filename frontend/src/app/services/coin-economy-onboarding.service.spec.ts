import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CoinEconomyOnboardingService } from './coin-economy-onboarding.service';

describe('CoinEconomyOnboardingService', () => {
  let service: CoinEconomyOnboardingService;

  let store: Record<string, string> = {};
  beforeAll(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => store[key] = value,
      removeItem: (key: string) => delete store[key],
      clear: () => store = {}
    });
  });


  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_coin_economy_onboarding_done');
    TestBed.configureTestingModule({});
    service = TestBed.inject(CoinEconomyOnboardingService);
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_coin_economy_onboarding_done');
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

  it('should have six step names', () => {
    expect(service.stepNames.length).toBe(6);
    expect(service.stepNames).toContain('coinEconomyStepBalance');
    expect(service.stepNames).toContain('coinEconomyStepBuyCoins');
    expect(service.stepNames).toContain('coinEconomyStepSendGift');
    expect(service.stepNames).toContain('coinEconomyStepStickerStore');
    expect(service.stepNames).toContain('coinEconomyStepShop');
    expect(service.stepNames).toContain('coinEconomyStepVIP');
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
    expect(window.localStorage.getItem('hellotalk_coin_economy_onboarding_done')).toBe('true');
  });

  it('should reset the onboarding state', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    service.reset();
    expect(service.isCompleted()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
    expect(window.localStorage.getItem('hellotalk_coin_economy_onboarding_done')).toBeNull();
  });
});