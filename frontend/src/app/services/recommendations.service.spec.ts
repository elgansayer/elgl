import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  parseDiscoveryRecommendations,
  RecommendationsService,
} from './recommendations.service';

const validRecommendation = {
  id: 'p-1',
  display_name: 'Aiko',
  avatar_url: null,
  native_languages: ['ja'],
  target_languages: ['en'],
  shared_interest_count: 2,
  recommendation_reasons: ['language_exchange', 'shared_interests'],
};

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let http: HttpTestingController;
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = 'access-token';
    TestBed.configureTestingModule({
      providers: [
        RecommendationsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: () => accessToken },
        },
      ],
    });

    service = TestBed.inject(RecommendationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads and validates the bounded discovery recommendation contract with auth', async () => {
    const promise = service.getDiscoveryRecommendations();
    const request = http.expectOne(`${environment.apiUrl}/recommendations/discovery`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');

    request.flush([validRecommendation]);

    await expect(promise).resolves.toEqual([
      expect.objectContaining({
        id: 'p-1',
        shared_interest_count: 2,
      }),
    ]);
  });

  it('fails before network access when the authenticated session is unavailable', async () => {
    accessToken = null;

    await expect(service.getDiscoveryRecommendations()).rejects.toThrow(
      'Authentication required',
    );
    http.expectNone(`${environment.apiUrl}/recommendations/discovery`);
  });

  it('rejects responses that exceed the ten-card server contract', () => {
    expect(() =>
      parseDiscoveryRecommendations(
        Array.from({ length: 11 }, (_, index) => ({
          ...validRecommendation,
          id: `profile-${index}`,
        })),
      ),
    ).toThrow('Invalid discovery recommendation response');
  });

  it('rejects duplicate profiles and malformed recommendation signals', () => {
    expect(() =>
      parseDiscoveryRecommendations([validRecommendation, validRecommendation]),
    ).toThrow('Invalid discovery recommendation response');

    expect(() =>
      parseDiscoveryRecommendations([
        {
          ...validRecommendation,
          shared_interest_count: Number.NaN,
        },
      ]),
    ).toThrow('Invalid discovery recommendation response');

    expect(() =>
      parseDiscoveryRecommendations([
        {
          ...validRecommendation,
          recommendation_reasons: ['language_exchange', 'future_signal'],
        },
      ]),
    ).toThrow('Invalid discovery recommendation response');
  });

  it('rejects unsafe avatar URLs and credential-bearing media URLs', () => {
    expect(() =>
      parseDiscoveryRecommendations([
        {
          ...validRecommendation,
          avatar_url: 'javascript:alert(1)',
        },
      ]),
    ).toThrow('Invalid discovery recommendation response');

    expect(() =>
      parseDiscoveryRecommendations([
        {
          ...validRecommendation,
          avatar_url: 'https://user:secret@example.com/avatar.jpg',
        },
      ]),
    ).toThrow('Invalid discovery recommendation response');
  });

  it('normalizes bounded text without exposing ranking internals', () => {
    expect(
      parseDiscoveryRecommendations([
        {
          ...validRecommendation,
          display_name: '  Aiko  ',
          avatar_url: 'https://cdn.example.com/avatar.jpg',
        },
      ]),
    ).toEqual([
      {
        ...validRecommendation,
        display_name: 'Aiko',
        avatar_url: 'https://cdn.example.com/avatar.jpg',
      },
    ]);
  });
});
