import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { ReadingEngineErrorHandlerService } from './reading-engine-error-handler.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

describe('ReadingEngineErrorHandlerService', () => {
  let service: ReadingEngineErrorHandlerService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    const mockAuthService = {
      getAccessToken: () => 'test-token',
      isAuthenticated: signal(true),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReadingEngineErrorHandlerService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(ReadingEngineErrorHandlerService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  it('should initialise with empty recent crashes', () => {
    expect(service.recentCrashes()).toEqual([]);
  });

  it('should send a crash report to analytics endpoint', () => {
    const testError = new Error('Reading engine rendering failed');
    service.reportReadingEngineCrash(testError, {
      boundaryContext: 'articles',
      renderingError: true,
      activeTab: 'articles',
    });

    const req = httpTesting.expectOne((request) =>
      request.url.includes('/analytics/client-error'),
    );
    expect(req.request.method).toBe('POST');

    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Reading engine rendering failed');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('reading-engine');
    expect(metadata['boundaryContext']).toBe('articles');
    expect(metadata['renderingError']).toBe(true);
    expect(metadata['activeTab']).toBe('articles');

    req.flush({ status: 'logged' });
  });

  it('should track recent crashes with a rolling buffer', () => {
    for (let i = 0; i < 12; i++) {
      service.reportReadingEngineCrash(new Error(`Crash ${i}`), {
        action: `action-${i}`,
      });
    }

    // Only the 10 most recent crashes should be kept
    expect(service.recentCrashes().length).toBe(10);
    expect(service.recentCrashes()[0].message).toBe('Crash 11');
    expect(service.recentCrashes()[9].message).toBe('Crash 2');

    // Flush all pending requests
    const requests = httpTesting.match((request) =>
      request.url.includes('/analytics/client-error'),
    );
    requests.forEach((req) => req.flush({ status: 'logged' }));
  });

  it('should send report with resource context', () => {
    const testError = new Error('Tokenisation error');
    service.reportReadingEngineCrash(testError, {
      boundaryContext: 'tokenise',
      resourceId: 'res-123',
      activeTab: 'articles',
      filterDifficulty: 'advanced',
    });

    const req = httpTesting.expectOne((request) =>
      request.url.includes('/analytics/client-error'),
    );
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['resourceId']).toBe('res-123');
    expect(metadata['filterDifficulty']).toBe('advanced');

    req.flush({ status: 'logged' });
  });

  it('should wrap API calls and return null on error', async () => {
    const result = await service.wrapReadingEngineCall(
      'fetchArticles',
      () => Promise.reject(new Error('Network failure')),
      { activeTab: 'articles' },
    );

    expect(result).toBeNull();

    const req = httpTesting.expectOne((request) =>
      request.url.includes('/analytics/client-error'),
    );
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Network failure');
    req.flush({ status: 'logged' });
  });

  it('should wrap API calls and return value on success', async () => {
    const result = await service.wrapReadingEngineCall(
      'fetchArticles',
      () => Promise.resolve({ data: 'success' }),
    );

    expect(result).toEqual({ data: 'success' });
  });

  it('should handle non-Error throws in wrapReadingEngineCall', async () => {
    const result = await service.wrapReadingEngineCall(
      'stringError',
      () => Promise.reject('plain string error'),
    );

    expect(result).toBeNull();

    const req = httpTesting.expectOne((request) =>
      request.url.includes('/analytics/client-error'),
    );
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('plain string error');
    req.flush({ status: 'logged' });
  });
});