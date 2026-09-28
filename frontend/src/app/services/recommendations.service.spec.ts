import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RecommendationsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'access-token' },
        },
      ],
    });

    service = TestBed.inject(RecommendationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the bounded discovery recommendation contract with auth', async () => {
    const promise = service.getDiscoveryRecommendations();
    const request = http.expectOne(`${environment.apiUrl}/recommendations/discovery`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');

    request.flush([
      {
        id: 'p-1',
        display_name: 'Aiko',
        avatar_url: null,
        native_languages: ['ja'],
        target_languages: ['en'],
        shared_interest_count: 2,
        recommendation_reasons: ['language_exchange', 'shared_interests'],
      },
    ]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({
        id: 'p-1',
        shared_interest_count: 2,
      }),
    ]);
  });
});
