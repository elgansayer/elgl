import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { VersionInfo, VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [VersionService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(VersionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the public version policy via GET', () => {
    const mockVersion: VersionInfo = {
      current: '2.0.0',
      latest: '2.1.0',
      minimumSupported: '2.0.0',
      updateUrl: 'https://github.com/elgansayer/elgl/releases/tag/v2.1.0',
    };

    service.getVersion().subscribe((version) => {
      expect(version).toEqual(mockVersion);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/version`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(mockVersion);
  });
});
