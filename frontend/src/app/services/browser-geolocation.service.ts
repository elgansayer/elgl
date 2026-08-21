import { Injectable } from '@angular/core';

export type BrowserLocationErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'invalid_position';

export interface BrowserCoordinates {
  latitude: number;
  longitude: number;
  /** Epoch milliseconds; kept in memory only and used to expire stale fixes. */
  capturedAt: number;
}

export class BrowserLocationError extends Error {
  constructor(
    readonly code: BrowserLocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BrowserLocationError';
  }
}

export const NEARBY_POSITION_OPTIONS: Readonly<PositionOptions> = {
  enableHighAccuracy: false,
  maximumAge: 0,
  timeout: 10_000,
};

type GeolocationLike = Pick<Geolocation, 'getCurrentPosition'>;

/**
 * Small testable wrapper around the browser geolocation API.
 *
 * The returned coordinates are never persisted here. Consumers are expected to
 * keep them in memory only unless the user has explicitly opted into a separate
 * location-sharing feature.
 */
export function requestBrowserCoordinates(
  geolocation: GeolocationLike | undefined,
  capturedAt = Date.now(),
  options: PositionOptions = NEARBY_POSITION_OPTIONS,
): Promise<BrowserCoordinates> {
  if (!geolocation) {
    return Promise.reject(
      new BrowserLocationError('unsupported', 'Browser geolocation is not supported.'),
    );
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          reject(
            new BrowserLocationError('invalid_position', 'Browser returned invalid coordinates.'),
          );
          return;
        }

        resolve({ latitude, longitude, capturedAt });
      },
      (error) => {
        switch (error.code) {
          case 1:
            reject(
              new BrowserLocationError('permission_denied', 'Location permission was denied.'),
            );
            return;
          case 2:
            reject(
              new BrowserLocationError(
                'position_unavailable',
                'The current location is unavailable.',
              ),
            );
            return;
          case 3:
            reject(new BrowserLocationError('timeout', 'Location lookup timed out.'));
            return;
          default:
            reject(
              new BrowserLocationError(
                'position_unavailable',
                'The current location could not be determined.',
              ),
            );
        }
      },
      options,
    );
  });
}

@Injectable({ providedIn: 'root' })
export class BrowserGeolocationService {
  getCurrentPosition(): Promise<BrowserCoordinates> {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
    return requestBrowserCoordinates(geolocation);
  }
}
