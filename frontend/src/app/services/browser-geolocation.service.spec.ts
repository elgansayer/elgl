import { describe, expect, it, vi } from 'vitest';
import {
  BrowserLocationError,
  NEARBY_POSITION_OPTIONS,
  requestBrowserCoordinates,
} from './browser-geolocation.service';

function fakeGeolocation(
  implementation: Geolocation['getCurrentPosition'],
): Pick<Geolocation, 'getCurrentPosition'> {
  return { getCurrentPosition: implementation };
}

describe('requestBrowserCoordinates', () => {
  it('fails explicitly when browser geolocation is unavailable', async () => {
    await expect(requestBrowserCoordinates(undefined)).rejects.toMatchObject({
      code: 'unsupported',
    });
  });

  it('returns finite coordinates and a capture timestamp without persisting them', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 51.5074, longitude: -0.1278 } } as GeolocationPosition);
    });

    await expect(
      requestBrowserCoordinates(fakeGeolocation(getCurrentPosition), 123456),
    ).resolves.toEqual({ latitude: 51.5074, longitude: -0.1278, capturedAt: 123456 });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      NEARBY_POSITION_OPTIONS,
    );
  });

  it.each([
    [1, 'permission_denied'],
    [2, 'position_unavailable'],
    [3, 'timeout'],
  ] as const)('maps geolocation error code %s to %s', async (code, expectedCode) => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code } as GeolocationPositionError);
    });

    await expect(requestBrowserCoordinates(fakeGeolocation(getCurrentPosition))).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it('rejects invalid coordinates instead of sending them to discovery', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({ coords: { latitude: 91, longitude: 0 } } as GeolocationPosition);
    });

    const error = await requestBrowserCoordinates(fakeGeolocation(getCurrentPosition)).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(BrowserLocationError);
    expect(error).toMatchObject({ code: 'invalid_position' });
  });
});
