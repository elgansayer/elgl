import { Injectable, signal } from '@angular/core';
import { I18nService } from './i18n.service';

export interface DiscoveryCoordinates {
  latitude: number;
  longitude: number;
  obtainedAt: number;
}

export type DiscoveryLocationStatus = 'idle' | 'locating' | 'ready' | 'error';
export type DiscoveryLocationErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout';

export class DiscoveryLocationError extends Error {
  constructor(readonly code: DiscoveryLocationErrorCode) {
    super(code);
    this.name = 'DiscoveryLocationError';
  }
}

const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAX_AGE_MS = 60_000;
const IMPERIAL_REGIONS = new Set(['GB', 'US', 'LR', 'MM']);

@Injectable({ providedIn: 'root' })
export class DiscoveryLocationService {
  readonly coordinates = signal<DiscoveryCoordinates | null>(null);
  readonly status = signal<DiscoveryLocationStatus>('idle');
  readonly errorCode = signal<DiscoveryLocationErrorCode | null>(null);

  private pendingRequest: Promise<DiscoveryCoordinates> | null = null;
  private generation = 0;

  constructor(private readonly i18n: I18nService) {}

  requestCurrentPosition(): Promise<DiscoveryCoordinates> {
    if (this.pendingRequest) return this.pendingRequest;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const error = new DiscoveryLocationError('unsupported');
      this.status.set('error');
      this.errorCode.set(error.code);
      return Promise.reject(error);
    }

    const generation = ++this.generation;
    this.status.set('locating');
    this.errorCode.set(null);

    const request = new Promise<DiscoveryCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (generation !== this.generation) {
            reject(new DiscoveryLocationError('position_unavailable'));
            return;
          }

          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            const error = new DiscoveryLocationError('position_unavailable');
            this.status.set('error');
            this.errorCode.set(error.code);
            reject(error);
            return;
          }

          const coordinates: DiscoveryCoordinates = {
            latitude,
            longitude,
            obtainedAt: Date.now(),
          };
          this.coordinates.set(coordinates);
          this.status.set('ready');
          resolve(coordinates);
        },
        (positionError) => {
          if (generation !== this.generation) {
            reject(new DiscoveryLocationError('position_unavailable'));
            return;
          }

          const error = new DiscoveryLocationError(this.mapErrorCode(positionError.code));
          this.coordinates.set(null);
          this.status.set('error');
          this.errorCode.set(error.code);
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: GEOLOCATION_MAX_AGE_MS,
        },
      );
    });

    this.pendingRequest = request;
    void request.finally(() => {
      if (this.pendingRequest === request) this.pendingRequest = null;
    });
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.pendingRequest = null;
    this.coordinates.set(null);
    this.errorCode.set(null);
    this.status.set('idle');
  }

  formatDistance(metres: number | undefined): string {
    if (metres === undefined || !Number.isFinite(metres) || metres < 0) return '';

    if (this.usesImperialDistance()) {
      const miles = metres / 1609.344;
      if (miles < 1) {
        const feet = Math.max(100, Math.round((metres * 3.28084) / 100) * 100);
        return `${feet.toLocaleString(this.i18n.currentLang())} ft`;
      }
      return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
    }

    if (metres < 1000) {
      const roundedMetres = Math.max(100, Math.round(metres / 100) * 100);
      return `${roundedMetres.toLocaleString(this.i18n.currentLang())} m`;
    }

    const kilometres = metres / 1000;
    return `${kilometres < 10 ? kilometres.toFixed(1) : Math.round(kilometres)} km`;
  }

  private usesImperialDistance(): boolean {
    try {
      const locale = new Intl.Locale(this.i18n.currentLang()).maximize();
      return locale.region ? IMPERIAL_REGIONS.has(locale.region) : false;
    } catch {
      return /^en-(gb|us)$/i.test(this.i18n.currentLang());
    }
  }

  private mapErrorCode(code: number): DiscoveryLocationErrorCode {
    switch (code) {
      case 1:
        return 'permission_denied';
      case 3:
        return 'timeout';
      default:
        return 'position_unavailable';
    }
  }
}
