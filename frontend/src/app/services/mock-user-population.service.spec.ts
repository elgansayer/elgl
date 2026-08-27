import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { MockUserPopulationService } from './mock-user-population.service';

describe('MockUserPopulationService', () => {
  let service: MockUserPopulationService;
  let httpMock: HttpTestingController;
  const originalProduction = environment.production;

  beforeEach(() => {
    environment.production = false;
    TestBed.configureTestingModule({
      providers: [
        MockUserPopulationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MockUserPopulationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    environment.production = originalProduction;
    httpMock.verify();
  });

  it('consumes the deterministic mock population endpoint for frontend tests', async () => {
    const resultPromise = firstValueFrom(service.load('minimal', 'playwright-2'));
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/mock/users`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('size')).toBe('minimal');
    expect(request.request.params.get('namespace')).toBe('playwright-2');

    request.flush({
      schemaVersion: 'mock-user-population-v1',
      namespace: 'playwright-2',
      size: 'minimal',
      count: 0,
      seed: 123,
      seedId: 'seed:playwright-2',
      profiles: [],
    });

    await expect(resultPromise).resolves.toMatchObject({
      namespace: 'playwright-2',
      size: 'minimal',
    });
  });

  it('fails closed before making a request in production builds', async () => {
    environment.production = true;

    await expect(firstValueFrom(service.load())).rejects.toThrow(
      'Mock user population is unavailable in production',
    );
    httpMock.expectNone(`${environment.apiUrl}/mock/users`);
  });
});
