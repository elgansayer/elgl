import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { VersionService } from '../services/version.service';
import { APP_VERSION } from '../version.constants';
import { CLIENT_VERSION_HEADER, clientVersionInterceptor } from './client-version.interceptor';

describe('clientVersionInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let versionService: VersionService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([clientVersionInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    versionService = TestBed.inject(VersionService);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('declares the build version on first-party API requests', async () => {
    const result = firstValueFrom(http.get(`${environment.apiUrl}/profile`));

    const request = httpTesting.expectOne(`${environment.apiUrl}/profile`);
    expect(request.request.headers.get(CLIENT_VERSION_HEADER)).toBe(APP_VERSION);
    request.flush({});
    await result;
  });

  it('never sends the version header to third-party hosts or lookalike prefixes', async () => {
    const urls = ['https://example.org/api/profile', `${environment.apiUrl}-evil/profile`];
    const results = urls.map((url) => firstValueFrom(http.get(url)));

    for (const url of urls) {
      const request = httpTesting.expectOne(url);
      expect(request.request.headers.has(CLIENT_VERSION_HEADER)).toBe(false);
      request.flush({});
    }
    await Promise.all(results);
  });

  it('opens the forced-update surface on a CLIENT_UPGRADE_REQUIRED 426 and rethrows', async () => {
    const result = firstValueFrom(http.get(`${environment.apiUrl}/profile`));

    httpTesting.expectOne(`${environment.apiUrl}/profile`).flush(
      {
        statusCode: 426,
        code: 'CLIENT_UPGRADE_REQUIRED',
        minimumSupported: '99.0.0',
        updateUrl: 'https://example.org/releases/latest',
      },
      { status: 426, statusText: 'Upgrade Required' },
    );

    const error = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(versionService.isDeprecated()).toBe(true);
    expect(versionService.minimumSupportedVersion()).toBe('99.0.0');
    expect(versionService.updateUrl()).toBe('https://example.org/releases/latest');
  });

  it('ignores a 426 that does not carry the upgrade-required code', async () => {
    const result = firstValueFrom(http.get(`${environment.apiUrl}/profile`));

    httpTesting
      .expectOne(`${environment.apiUrl}/profile`)
      .flush({ message: 'Upgrade to TLS' }, { status: 426, statusText: 'Upgrade Required' });

    await result.catch(() => undefined);
    expect(versionService.isDeprecated()).toBe(false);
  });

  it('does not treat other failures as an upgrade request', async () => {
    const result = firstValueFrom(http.get(`${environment.apiUrl}/profile`));

    httpTesting
      .expectOne(`${environment.apiUrl}/profile`)
      .flush({ code: 'CLIENT_UPGRADE_REQUIRED' }, { status: 403, statusText: 'Forbidden' });

    await result.catch(() => undefined);
    expect(versionService.isDeprecated()).toBe(false);
  });
});
