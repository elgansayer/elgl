import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CrashReportService } from './crash-report.service';

describe('CrashReportService', () => {
  let service: CrashReportService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CrashReportService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  it('should POST crash payload to analytics endpoint', () => {
    const error = new Error('Discovery map rendering failed');
    service.reportCrash(error, { feature: 'discovery', component: 'DiscoveryMap', renderingError: true });

    const req = httpTesting.expectOne('http://localhost:3000/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Discovery map rendering failed');
    expect(body['name']).toBe('Error');
    expect(body['url']).toBeDefined();
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['feature']).toBe('discovery');
    expect(metadata['component']).toBe('DiscoveryMap');
    expect(metadata['renderingError']).toBe(true);
    req.flush({ status: 'logged' });
  });

  it('should add crash to recentCrashes signal', () => {
    const error = new Error('Test crash');
    service.reportCrash(error, { feature: 'discovery' });

    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].message).toBe('Test crash');
    expect(service.recentCrashes()[0].feature).toBe('discovery');

    httpTesting.expectOne('http://localhost:3000/api/analytics/client-error').flush({ status: 'logged' });
  });

  it('should cap recentCrashes at MAX entries', () => {
    for (let i = 0; i < 25; i++) {
      service.reportCrash(new Error(`Crash ${i}`), { feature: 'test' });
    }
    httpTesting.match('http://localhost:3000/api/analytics/client-error').forEach((req) => req.flush({}));
    expect(service.recentCrashes().length).toBe(20);
  });

  it('should report crashes with string errors', () => {
    service.reportCrash(new Error('Something went wrong'), { feature: 'discovery', action: 'searchPartners' });

    const req = httpTesting.expectOne('http://localhost:3000/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['feature']).toBe('discovery');
    expect(metadata['action']).toBe('searchPartners');
    req.flush({ status: 'logged' });
  });

  it('wrapCall should return result on success', async () => {
    const result = await service.wrapCall('discovery', 'findPartners', async () => 'success', 'fallback');
    expect(result).toBe('success');
    httpTesting.expectNone('http://localhost:3000/api/analytics/client-error');
  });

  it('wrapCall should report crash and return fallback on failure', async () => {
    const result = await service.wrapCall(
      'discovery',
      'findPartners',
      async () => { throw new Error('API failure'); },
      'fallback',
    );
    expect(result).toBe('fallback');

    const req = httpTesting.expectOne('http://localhost:3000/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['feature']).toBe('discovery');
    expect(metadata['action']).toBe('findPartners');
    req.flush({ status: 'logged' });
  });
});