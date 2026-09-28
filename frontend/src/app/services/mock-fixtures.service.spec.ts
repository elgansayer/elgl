import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigurationService } from '../core/config/configuration.service';
import { MockFixturesService } from './mock-fixtures.service';

describe('MockFixturesService integration', () => {
  let service: MockFixturesService;
  let httpMock: HttpTestingController;
  let configuration: {
    isMockBackend: boolean;
    config: { apiEndpoint: string };
  };

  beforeEach(() => {
    configuration = {
      isMockBackend: true,
      config: { apiEndpoint: 'http://localhost:3000/api' },
    };

    TestBed.configureTestingModule({
      providers: [
        MockFixturesService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigurationService, useValue: configuration },
      ],
    });

    service = TestBed.inject(MockFixturesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('consumes namespace reset and reseed responses from the mock API', () => {
    service.reset('worker-a').subscribe((result) => {
      expect(result.summary.totalRecords).toBe(160);
    });

    const reset = httpMock.expectOne(
      'http://localhost:3000/api/mock/fixtures/reset',
    );
    expect(reset.request.method).toBe('POST');
    expect(reset.request.body).toEqual({ namespace: 'worker-a' });
    reset.flush({
      namespace: 'worker-a',
      seed: 7932,
      seedId: 'elgl-offline-fixtures@mulberry32-v1:7932',
      operation: 'reset',
      summary: { users: 150, linkedAccounts: 10, totalRecords: 160 },
    });

    service.reseed(4242, 'worker-a').subscribe();

    const reseed = httpMock.expectOne(
      'http://localhost:3000/api/mock/fixtures/reseed',
    );
    expect(reseed.request.body).toEqual({ namespace: 'worker-a', seed: 4242 });
    reseed.flush({
      namespace: 'worker-a',
      seed: 4242,
      seedId: 'elgl-offline-fixtures@mulberry32-v1:4242',
      operation: 'reseed',
      summary: { users: 150, linkedAccounts: 10, totalRecords: 160 },
    });
  });

  it('consumes named snapshot capture and restore commands', () => {
    service.captureSnapshot('baseline', 'worker-b').subscribe();
    const capture = httpMock.expectOne(
      'http://localhost:3000/api/mock/fixtures/snapshot',
    );
    expect(capture.request.body).toEqual({
      namespace: 'worker-b',
      checkpoint: 'baseline',
    });
    capture.flush({
      namespace: 'worker-b',
      seed: 7932,
      seedId: 'elgl-offline-fixtures@mulberry32-v1:7932',
      operation: 'snapshot',
      checkpoint: 'baseline',
      summary: { users: 150, linkedAccounts: 10, totalRecords: 160 },
    });

    service.restoreSnapshot('baseline', 'worker-b').subscribe();
    const restore = httpMock.expectOne(
      'http://localhost:3000/api/mock/fixtures/restore',
    );
    expect(restore.request.body).toEqual({
      namespace: 'worker-b',
      checkpoint: 'baseline',
    });
    restore.flush({
      namespace: 'worker-b',
      seed: 7932,
      seedId: 'elgl-offline-fixtures@mulberry32-v1:7932',
      operation: 'restore',
      checkpoint: 'baseline',
      summary: { users: 150, linkedAccounts: 10, totalRecords: 160 },
    });
  });

  it('fails closed before issuing a request outside mock mode', () => {
    configuration.isMockBackend = false;

    expect(() => service.reset()).toThrow(
      'Mock fixture controls are available only in an explicit mock backend profile',
    );
    httpMock.expectNone('http://localhost:3000/api/mock/fixtures/reset');
  });
});
