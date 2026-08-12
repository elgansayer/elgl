import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiscoveryErrorHandlerService } from './discovery-error-handler.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';
import { environment } from '../../environments/environment';

describe('DiscoveryErrorHandlerService', () => {
  let service: DiscoveryErrorHandlerService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'mock-token',
            currentUser: signal(null),
          },
        },
      ],
    });

    service = TestBed.inject(DiscoveryErrorHandlerService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should POST crash report to analytics endpoint', () => {
    const error = new Error('Partner search rendering failure');
    service.reportDiscoveryCrash(error, {
      filterType: 'nearby',
      targetLanguage: 'JA',
      partnerCount: 5,
      sortMode: 'nearest',
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Partner search rendering failure');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('discovery');
    expect(metadata['filterType']).toBe('nearby');
    expect(metadata['targetLanguage']).toBe('JA');
    expect(metadata['partnerCount']).toBe(5);
    expect(metadata['sortMode']).toBe('nearest');

    req.flush({ status: 'logged' });
  });

  it('should record crash in recentCrashes signal', () => {
    const error = new Error('Search filter crash');
    service.reportDiscoveryCrash(error, { action: 'searchPartners' });

    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].message).toBe('Search filter crash');
    expect(service.recentCrashes()[0].context).toBe('searchPartners');
  });

  it('should trim recentCrashes to MAX_RECENT_CRASHES', () => {
    for (let i = 0; i < 12; i++) {
      service.reportDiscoveryCrash(new Error(`Crash ${i}`));
      httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    }

    expect(service.recentCrashes().length).toBe(10);
    expect(service.recentCrashes()[0].message).toBe('Crash 11');
  });

  it('should handle non-Error objects in wrapDiscoveryCall', async () => {
    const result = await service.wrapDiscoveryCall('testAction', () => {
      return Promise.reject('string error');
    });

    expect(result).toBeNull();

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('string error');
    req.flush({ status: 'logged' });
  });

  it('should return result for successful wrapDiscoveryCall', async () => {
    const result = await service.wrapDiscoveryCall('testAction', async () => 42);

    expect(result).toBe(42);
    httpTesting.verify();
  });

  it('should handle analytics endpoint failure gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    service.reportDiscoveryCrash(new Error('Test'));

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    req.flush(null, { status: 500, statusText: 'ISE' });

    // Should not throw
    expect(() => {}).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('should include default values when context is empty', () => {
    service.reportDiscoveryCrash(new Error('Bare crash'));

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('discovery');
    expect(metadata['isVip']).toBe(false);
    expect(metadata['renderingError']).toBe(false);

    req.flush({ status: 'logged' });
  });
});
