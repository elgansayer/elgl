import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { VersionInfo, VersionService, compareSemanticVersions } from './version.service';

const supportedResponse: VersionInfo = {
  current: '2.0.0',
  latest: '2.0.0',
  minimumSupported: '2.0.0',
  updateUrl: 'https://github.com/elgansayer/elgl/releases/latest',
};

describe('VersionService', () => {
  let service: VersionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        VersionService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(VersionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('fetches version info via GET', async () => {
    const result = firstValueFrom(service.getVersion());
    const request = httpMock.expectOne(`${environment.apiUrl}/version`);

    expect(request.request.method).toBe('GET');
    request.flush(supportedResponse);
    await expect(result).resolves.toEqual(supportedResponse);
  });

  it('uses the backend minimum supported version to block an older client', async () => {
    const result = service.checkVersion();
    httpMock
      .expectOne(`${environment.apiUrl}/version`)
      .flush({ ...supportedResponse, minimumSupported: '2.1.0' });

    await expect(result).resolves.toBe(true);
    expect(service.isDeprecated()).toBe(true);
    expect(service.minimumSupportedVersion()).toBe('2.1.0');
    expect(service.checkFailed()).toBe(false);
  });

  it('keeps an equal or newer client usable', async () => {
    const result = service.checkVersion();
    httpMock.expectOne(`${environment.apiUrl}/version`).flush(supportedResponse);

    await expect(result).resolves.toBe(false);
    expect(service.isDeprecated()).toBe(false);
  });

  it('uses only HTTPS update destinations returned by the backend', async () => {
    const result = service.checkVersion();
    httpMock.expectOne(`${environment.apiUrl}/version`).flush({
      ...supportedResponse,
      updateUrl: 'javascript:alert(1)',
    });

    await result;
    expect(service.updateUrl()).toBe('https://github.com/elgansayer/elgl/releases/latest');
  });

  it('falls back to the bundled policy when the response is malformed', async () => {
    const result = service.checkVersion();
    httpMock
      .expectOne(`${environment.apiUrl}/version`)
      .flush({ ...supportedResponse, minimumSupported: 'not-semver' });

    await expect(result).resolves.toBe(false);
    expect(service.checkFailed()).toBe(true);
    expect(service.minimumSupportedVersion()).toBe('2.0.0');
  });

  it('falls back to the bundled policy when the version endpoint is unavailable', async () => {
    const result = service.checkVersion();
    httpMock.expectOne(`${environment.apiUrl}/version`).flush('unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(result).resolves.toBe(false);
    expect(service.checkFailed()).toBe(true);
    expect(service.isChecking()).toBe(false);
  });

  it('deduplicates concurrent version checks', async () => {
    const first = service.checkVersion();
    const second = service.checkVersion();
    httpMock
      .expectOne(`${environment.apiUrl}/version`)
      .flush({ ...supportedResponse, minimumSupported: '2.1.0' });

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
    expect(compareSemanticVersions('02.0.0', '2.0.0')).toBeNull();
    expect(compareSemanticVersions('2.0.0-beta.01', '2.0.0')).toBeNull();
  });
});
