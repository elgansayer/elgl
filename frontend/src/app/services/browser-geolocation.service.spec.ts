import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserGeolocationService } from './browser-geolocation.service';

describe('BrowserGeolocationService', () => {
  const service = new BrowserGeolocationService();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns finite coordinates without persisting them', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 51.5074,
          longitude: -0.1278,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const result = await service.getCurrentPosition();

    expect(result.latitude).toBe(51.5074);
    expect(result.longitude).toBe(-0.1278);
    expect(Number.isFinite(result.capturedAt)).toBe(true);
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: false, timeout: 10_000 }),
    );
  });

  it('fails as unsupported when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {});

    await expect(service.getCurrentPosition()).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it.each([
    [1, 'permission_denied'],
    [2, 'position_unavailable'],
    [3, 'timeout'],
  ] as const)('maps browser error %s to %s', async (code, expected) => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code, message: 'sensitive browser detail' } as GeolocationPositionError);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await expect(service.getCurrentPosition()).rejects.toEqual(
      expect.objectContaining({ code: expected }),
    );
  });

  it('rejects malformed coordinates instead of forwarding them to discovery', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: Number.NaN, longitude: 0 },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await expect(service.getCurrentPosition()).rejects.toMatchObject({
      code: 'position_unavailable',
    });
  });
});
