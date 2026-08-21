import { Injectable, signal } from '@angular/core';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';

/**
 * Checks whether the installed app version is deprecated and
 * exposes a reactive signal that can be used to show a blocking modal.
 * Use `<app-forced-update-modal/>` bound to `isDeprecated()` in the root template.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
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
