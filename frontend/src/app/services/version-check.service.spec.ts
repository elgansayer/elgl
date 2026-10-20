import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VersionCheckService,
  compareSemanticVersions,
} from './version-check.service';
import { VersionInfo, VersionService } from './version.service';

const supportedResponse: VersionInfo = {
  current: '2.0.0',
  latest: '2.0.0',
  minimumSupported: '2.0.0',
  updateUrl: 'https://github.com/elgansayer/elgl/releases/latest',
};

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let getVersion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    getVersion = vi.fn().mockReturnValue(of(supportedResponse));
    TestBed.configureTestingModule({
      providers: [
        VersionCheckService,
        { provide: VersionService, useValue: { getVersion } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(VersionCheckService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('uses the backend minimum supported version to block an older client', async () => {
    getVersion.mockReturnValue(
      of({ ...supportedResponse, minimumSupported: '2.1.0' } satisfies VersionInfo),
    );

    await expect(service.checkVersion()).resolves.toBe(true);
    expect(service.isDeprecated()).toBe(true);
    expect(service.minimumSupportedVersion()).toBe('2.1.0');
    expect(service.checkFailed()).toBe(false);
  });

  it('keeps an equal or newer client usable', async () => {
    await expect(service.checkVersion()).resolves.toBe(false);
    expect(service.isDeprecated()).toBe(false);
  });

  it('uses only http(s) update destinations returned by the backend', async () => {
    getVersion.mockReturnValue(
      of({
        ...supportedResponse,
        updateUrl: 'javascript:alert(1)',
      } satisfies VersionInfo),
    );

    await service.checkVersion();

    expect(service.updateUrl()).toBe('https://github.com/elgansayer/elgl/releases/latest');
  });

  it('falls back to the bundled policy when the response is malformed', async () => {
    getVersion.mockReturnValue(
      of({ ...supportedResponse, minimumSupported: 'not-semver' } satisfies VersionInfo),
    );

    await expect(service.checkVersion()).resolves.toBe(false);
    expect(service.checkFailed()).toBe(true);
    expect(service.minimumSupportedVersion()).toBe('2.0.0');
  });

  it('falls back to the bundled policy when the version endpoint is unavailable', async () => {
    getVersion.mockReturnValue(throwError(() => new Error('network unavailable')));

    await expect(service.checkVersion()).resolves.toBe(false);
    expect(service.checkFailed()).toBe(true);
    expect(service.isChecking()).toBe(false);
  });

  it('deduplicates concurrent version checks', async () => {
    const response = new Subject<VersionInfo>();
    getVersion.mockReturnValue(response.asObservable());

    const first = service.checkVersion();
    const second = service.checkVersion();
    expect(getVersion).toHaveBeenCalledTimes(1);

    response.next({ ...supportedResponse, minimumSupported: '2.1.0' });
    response.complete();

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
  });
});

describe('compareSemanticVersions', () => {
  it('orders major, minor and patch versions', () => {
    expect(compareSemanticVersions('2.0.0', '2.1.0')).toBe(-1);
    expect(compareSemanticVersions('2.1.1', '2.1.0')).toBe(1);
    expect(compareSemanticVersions('2.1.0', '2.1.0')).toBe(0);
  });

  it('honours semantic-version prerelease precedence', () => {
    expect(compareSemanticVersions('2.1.0-beta.2', '2.1.0-beta.10')).toBe(-1);
    expect(compareSemanticVersions('2.1.0-beta.1', '2.1.0')).toBe(-1);
  });

  it('rejects malformed versions rather than guessing', () => {
    expect(compareSemanticVersions('2.latest', '2.0.0')).toBeNull();
    expect(compareSemanticVersions('2.0.0', 'latest')).toBeNull();
  });
});
