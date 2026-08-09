import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';

interface MinimumVersionResponse {
  minimumSupported: string;
}

/**
 * Checks whether the installed app version is deprecated and
 * exposes a reactive signal that can be used to show a blocking modal.
 *
 * Fetches the minimum supported version from the backend API at startup.
 * Falls back to the build-time `MIN_SUPPORTED_VERSION` constant if the
 * network request fails.
 *
 * Use `<app-forced-update-modal/>` bound to `isDeprecated()` in the root template.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private http = inject(HttpClient);

  /** True when the current app version is below the minimum supported version */
  readonly isDeprecated = signal(false);

  /** Parse and compare version strings */
  private isVersionLower(installed: string, minimum: string): boolean {
    const toParts = (v: string) => v.split('.').map(Number);
    const i = toParts(installed);
    const m = toParts(minimum);
    for (let p = 0; p < 3; p++) {
      const iv = i[p] || 0;
      const mv = m[p] || 0;
      if (iv !== mv) {
        return iv < mv;
      }
    }
    return false; // equal versions are not deprecated
  }

  /**
   * Fetches the minimum supported version from the backend and compares
   * against the installed `APP_VERSION`. Updates the `isDeprecated` signal.
   *
   * Falls back to the build-time `MIN_SUPPORTED_VERSION` constant if the
   * network request fails.
   *
   * @returns true if the app is deprecated
   */
  async checkVersion(): Promise<boolean> {
    let minimumVersion = MIN_SUPPORTED_VERSION;

    try {
      const response = await firstValueFrom(
        this.http.get<MinimumVersionResponse>(
          `${environment.apiUrl}/version/minimum`,
        ),
      );
      if (response?.minimumSupported) {
        minimumVersion = response.minimumSupported;
      }
    } catch {
      // Network or server error -- use build-time fallback
    }

    const deprecated = this.isVersionLower(APP_VERSION, minimumVersion);
    this.isDeprecated.set(deprecated);
    return deprecated;
  }
}
