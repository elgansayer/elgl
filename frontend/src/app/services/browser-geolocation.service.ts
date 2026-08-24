import { Injectable } from '@angular/core';

export type GeolocationFailureCode =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout';

export interface BrowserCoordinates {
  latitude: number;
  longitude: number;
  capturedAt: number;
}

export class BrowserGeolocationError extends Error {
  constructor(readonly code: GeolocationFailureCode) {
    super(code);
    this.name = 'BrowserGeolocationError';
  }
}

const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 60_000;
const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_TIMEOUT = 3;

@Injectable({ providedIn: 'root' })
export class BrowserGeolocationService {
  getCurrentPosition(): Promise<BrowserCoordinates> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.reject(new BrowserGeolocationError('unsupported'));
    }

    return new Promise<BrowserCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
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
            reject(new BrowserGeolocationError('position_unavailable'));
            return;
          }

          resolve({
            latitude,
            longitude,
            capturedAt: Date.now(),
          });
        },
        (error) => {
          switch (error.code) {
            case GEOLOCATION_PERMISSION_DENIED:
              reject(new BrowserGeolocationError('permission_denied'));
              return;
            case GEOLOCATION_TIMEOUT:
              reject(new BrowserGeolocationError('timeout'));
              return;
            default:
              reject(new BrowserGeolocationError('position_unavailable'));
          }
        },
        {
          enableHighAccuracy: false,
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: GEOLOCATION_MAX_AGE_MS,
        },
      );
    });
  }
}
