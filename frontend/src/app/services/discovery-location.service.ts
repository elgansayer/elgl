import { Injectable, inject, signal } from '@angular/core';
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
const NEARBY_CACHE_SCOPE = 'nearby-memory-origin';

@Injectable({ providedIn: 'root' })
export class DiscoveryLocationService {
  private readonly i18n = inject(I18nService);

  readonly coordinates = signal<DiscoveryCoordinates | null>(null);
  readonly status = signal<DiscoveryLocationStatus>('idle');
  readonly errorCode = signal<DiscoveryLocationErrorCode | null>(null);

  private pendingRequest: Promise<DiscoveryCoordinates> | null = null;
  private generation = 0;

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
    const clearPending = () => {
      if (this.pendingRequest === request) this.pendingRequest = null;
    };
    void request.then(clearPending, clearPending);
    return request;
  }

  /**
   * Add coordinates as non-enumerable request properties. DiscoveryService can
   * still read them for the HTTP query, but its IndexedDB cache key builder
   * (Object.entries) cannot persist the precise browser location. The explicit
   * enumerable scope marker also prevents the result set colliding with a
   * non-location nearest search.
   */
  scopeNearbyFilters<T extends Record<string, unknown>>(
    filters: T,
    coordinates: DiscoveryCoordinates,
  ): T & { latitude: number; longitude: number } {
    const scoped = { ...filters, location_cache_scope: NEARBY_CACHE_SCOPE };
    Object.defineProperties(scoped, {
      latitude: { value: coordinates.latitude, enumerable: false },
      longitude: { value: coordinates.longitude, enumerable: false },
    });
    return scoped as T & { latitude: number; longitude: number };
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
      return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
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
