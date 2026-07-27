import { Injectable, signal } from '@angular/core';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';

/**
 * Checks whether the installed app version is deprecated and
 * exposes a reactive signal that can be used to show a blocking modal.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  /** True when the current app version is below the minimum supported version */
  readonly isDeprecated = signal(false);

  /**
   * Platform-specific store link shown inside the forced-update modal.
   * Can be overridden by consumers.
   */
  private readonly storeBase = 'https://yourapp.com/update';

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
   * @returns true if the app is deprecated
   */
  async checkVersion(): Promise<boolean> {
    const deprecated = this.isVersionLower(APP_VERSION, MIN_SUPPORTED_VERSION);
    this.isDeprecated.set(deprecated);
    return deprecated;
  }

  /**
   * Returns a store link appropriate for the current device.
   * Override this method in a subclass or configure the base URL.
   */
  getUpdateStoreUrl(): string {
    // Basic user‑agent detection; refine as needed
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const android = /android/i.test(window.navigator.userAgent);
    if (ios) return `${this.storeBase}?platform=ios`;
    if (android) return `${this.storeBase}?platform=android`;
    return this.storeBase;
  }
}
