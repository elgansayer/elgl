import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryLocationService } from './discovery-location.service';
import { I18nService } from './i18n.service';

function createService(language = 'en-GB'): DiscoveryLocationService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      DiscoveryLocationService,
      {
        provide: I18nService,
        useValue: { currentLang: signal(language) },
      },
    ],
  });
  return TestBed.inject(DiscoveryLocationService);
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

describe('DiscoveryLocationService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('does not request location until explicitly asked', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const service = createService();

    expect(service.status()).toBe('idle');
    expect(service.coordinates()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('acquires coordinates in memory with bounded browser options', async () => {
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _error: PositionErrorCallback, options?: PositionOptions) => {
        expect(options).toEqual({
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 60_000,
        });
        success(position(54.047, -2.801));
      },
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const service = createService();

    const result = await service.requestCurrentPosition();

    expect(result.latitude).toBe(54.047);
    expect(result.longitude).toBe(-2.801);
    expect(service.coordinates()?.latitude).toBe(54.047);
    expect(service.status()).toBe('ready');
    expect(service.errorCode()).toBeNull();
  });

  it('maps permission denial without retaining coordinates', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1, message: 'denied' } as GeolocationPositionError),
      },
    });
    const service = createService();

    await expect(service.requestCurrentPosition()).rejects.toMatchObject({
      code: 'permission_denied',
    });
    expect(service.coordinates()).toBeNull();
    expect(service.status()).toBe('error');
  });

  it('maps geolocation timeouts', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 3, message: 'timeout' } as GeolocationPositionError),
      },
    });
    const service = createService();

    await expect(service.requestCurrentPosition()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('coalesces repeated requests while the permission prompt is pending', async () => {
    let resolvePosition: PositionCallback | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      resolvePosition = success;
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const service = createService();

    const first = service.requestCurrentPosition();
    const second = service.requestCurrentPosition();
    expect(first).toBe(second);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    resolvePosition?.(position(35.6762, 139.6503));
    await expect(first).resolves.toMatchObject({ latitude: 35.6762, longitude: 139.6503 });
  });

  it('keeps precise coordinates out of enumerable cache-key inputs', () => {
    const service = createService();
    const scoped = service.scopeNearbyFilters(
      { radius_metres: 10_000, sort: 'nearest' },
      { latitude: 54.047, longitude: -2.801, obtainedAt: Date.now() },
    );

    expect(scoped.latitude).toBe(54.047);
    expect(scoped.longitude).toBe(-2.801);
    expect(Object.entries(scoped)).toContainEqual(['location_cache_scope', 'nearby-memory-origin']);
    expect(Object.keys(scoped)).not.toContain('latitude');
    expect(Object.keys(scoped)).not.toContain('longitude');
  });

  it('formats one privacy-rounded distance in miles or kilometres for the locale', () => {
    expect(createService('en-GB').formatDistance(5000)).toBe('3.1 mi');
    expect(createService('en-US').formatDistance(500)).toBe('0.3 mi');
    expect(createService('fr').formatDistance(5000)).toBe('5.0 km');
    expect(createService('ja').formatDistance(520)).toBe('0.5 km');
  });

  it('clears in-memory location state', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success(position(51.5, -0.12)),
      },
    });
    const service = createService();
    await service.requestCurrentPosition();

    service.clear();

    expect(service.coordinates()).toBeNull();
    expect(service.status()).toBe('idle');
    expect(service.errorCode()).toBeNull();
  });
});
