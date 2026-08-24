import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';
import { VersionInfo, VersionService } from './version.service';

const DEFAULT_UPDATE_URL = 'https://github.com/elgansayer/elgl/releases/latest';
const SEMVER_PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemanticVersion(value: string): ParsedVersion | null {
  const match = SEMVER_PATTERN.exec(value.trim());
  if (!match) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;

  return {
    major,
    minor,
    patch,
    prerelease: match[4]?.split('.') ?? [],
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;

    const lNumeric = /^\d+$/.test(l);
    const rNumeric = /^\d+$/.test(r);
    if (lNumeric && rNumeric) {
      const lNumber = Number(l);
      const rNumber = Number(r);
      if (lNumber !== rNumber) return lNumber < rNumber ? -1 : 1;
      continue;
    }
    if (lNumeric !== rNumeric) return lNumeric ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

/**
 * Compare two semantic versions. Returns a negative number when `left` is older,
 * zero when they are equivalent, and a positive number when `left` is newer.
 * Invalid versions return `null` instead of guessing an ordering.
 */
export function compareSemanticVersions(left: string, right: string): number | null {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  if (!parsedLeft || !parsedRight) return null;

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (parsedLeft[key] !== parsedRight[key]) {
      return parsedLeft[key] < parsedRight[key] ? -1 : 1;
    }
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

function safeUpdateUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Checks the deployed app version against the backend's operator-controlled
 * minimum supported version and exposes state for the blocking update UI.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private readonly versionService = inject(VersionService);
  private readonly platformId = inject(PLATFORM_ID);
  private inFlightCheck: Promise<boolean> | null = null;

  /** True when the current app version is below the effective minimum. */
  readonly isDeprecated = signal(false);
  /** True while a browser-side policy refresh is in progress. */
  readonly isChecking = signal(false);
  /** True when the remote policy could not be trusted and the bundled floor is in use. */
  readonly checkFailed = signal(false);
  readonly minimumSupportedVersion = signal(MIN_SUPPORTED_VERSION);
  readonly updateUrl = signal(DEFAULT_UPDATE_URL);

  constructor() {
    this.applyMinimumVersion(MIN_SUPPORTED_VERSION);
  }

  /**
   * Refresh the minimum supported version from the public version endpoint.
   * Concurrent callers share one request. A failed/malformed response falls back
   * to the bundled minimum so a transient outage cannot brick otherwise-supported clients.
   */
  checkVersion(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(this.isDeprecated());
    }

    if (this.inFlightCheck) return this.inFlightCheck;

    this.inFlightCheck = this.refreshVersionPolicy().finally(() => {
      this.inFlightCheck = null;
    });
    return this.inFlightCheck;
  }

  private async refreshVersionPolicy(): Promise<boolean> {
    this.isChecking.set(true);
    this.checkFailed.set(false);

    try {
      const response = await firstValueFrom(this.versionService.getVersion());
      const minimum = this.readMinimumSupported(response);
      if (!minimum) {
        throw new Error('Invalid minimum supported version response');
      }

      this.minimumSupportedVersion.set(minimum);
      this.applyMinimumVersion(minimum);
      this.updateUrl.set(safeUpdateUrl(response.updateUrl) ?? DEFAULT_UPDATE_URL);
      return this.isDeprecated();
    } catch {
      this.checkFailed.set(true);
      this.minimumSupportedVersion.set(MIN_SUPPORTED_VERSION);
      this.updateUrl.set(DEFAULT_UPDATE_URL);
      this.applyMinimumVersion(MIN_SUPPORTED_VERSION);
      return this.isDeprecated();
    } finally {
      this.isChecking.set(false);
    }
  }

  private readMinimumSupported(response: VersionInfo): string | null {
    if (typeof response.minimumSupported !== 'string') return null;
    return parseSemanticVersion(response.minimumSupported) ? response.minimumSupported.trim() : null;
  }

  private applyMinimumVersion(minimum: string): void {
    const comparison = compareSemanticVersions(APP_VERSION, minimum);
    // A malformed bundled/current version must not trigger an irreversible false positive.
    this.isDeprecated.set(comparison !== null && comparison < 0);
  }
}
