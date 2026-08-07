import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VersionCheckService } from './version-check.service';
import { environment } from '../../environments/environment';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        VersionCheckService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise isDeprecated as false', () => {
    expect(service.isDeprecated()).toBe(false);
  });

  it('should expose reactive isDeprecated signal', () => {
    expect(typeof service.isDeprecated()).toBe('boolean');
  });

  it('should fetch minimum version from backend and set isDeprecated to false when version is equal', async () => {
    const checkPromise = service.checkVersion();

    const req = httpMock.expectOne(`${environment.apiUrl}/version/minimum`);
    expect(req.request.method).toBe('GET');
    req.flush({ minimumSupported: '2.0.0' });

    await checkPromise;
    expect(service.isDeprecated()).toBe(false);
  });

  it('should set isDeprecated to true when installed version is lower than minimum', async () => {
    const checkPromise = service.checkVersion();

    const req = httpMock.expectOne(`${environment.apiUrl}/version/minimum`);
    req.flush({ minimumSupported: '3.0.0' });

    await checkPromise;
    expect(service.isDeprecated()).toBe(true);
  });

  it('should fall back to build-time constant when API call fails', async () => {
    const checkPromise = service.checkVersion();

    const req = httpMock.expectOne(`${environment.apiUrl}/version/minimum`);
    req.error(new ProgressEvent('Network error'));

    await checkPromise;
    // MIN_SUPPORTED_VERSION is '2.0.0' which equals APP_VERSION '2.0.0'
    expect(service.isDeprecated()).toBe(false);
  });

  it('should handle missing minimumSupported field in response', async () => {
    const checkPromise = service.checkVersion();

    const req = httpMock.expectOne(`${environment.apiUrl}/version/minimum`);
    req.flush({});

    await checkPromise;
    // Falls back to MIN_SUPPORTED_VERSION '2.0.0'
    expect(service.isDeprecated()).toBe(false);
  });
});