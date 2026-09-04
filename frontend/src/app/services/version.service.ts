import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { signal } from '@angular/core';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';

export interface VersionInfo {
  current: string;
  latest: string;
  updateUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private http = inject(HttpClient);

  getVersion(): Observable<VersionInfo> {
    return this.http.get<VersionInfo>(
      `${environment.apiUrl}/version`,
    );
  }

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
   * Runs the version comparison and updates the `isDeprecated` signal.
   * The root template binds to `isDeprecated()` to show a blocking update modal.
   * @returns true if the app is deprecated
   */
  checkVersion(): boolean {
    const deprecated = this.isVersionLower(APP_VERSION, MIN_SUPPORTED_VERSION);
    this.isDeprecated.set(deprecated);
    return deprecated;
  }
}
