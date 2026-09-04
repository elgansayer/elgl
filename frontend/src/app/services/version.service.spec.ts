import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { VersionService, VersionInfo } from './version.service';
import { environment } from '../../environments/environment';

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
      ],
    });

    service = TestBed.inject(VersionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch version info via GET request', () => {
    const mockVersion: VersionInfo = {
      current: '1.0.0',
      latest: '1.1.0',
      updateUrl: 'https://example.com/update',    };

    service.getVersion().subscribe((version) => {
      expect(version).toEqual(mockVersion);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/version`);
    expect(req.request.method).toBe('GET');
    req.flush(mockVersion);
  });

  it('should initialise isDeprecated as false', () => {
    expect(service.isDeprecated()).toBe(false);
  });

  it('should expose reactive isDeprecated signal', () => {
    expect(typeof service.isDeprecated()).toBe('boolean');
  });
});
