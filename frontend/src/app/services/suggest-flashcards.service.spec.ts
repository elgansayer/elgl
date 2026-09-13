import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SuggestFlashcardsService } from './suggest-flashcards.service';

describe('SuggestFlashcardsService', () => {
  let service: SuggestFlashcardsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SuggestFlashcardsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('session-token') },
        },
      ],
    });

    service = TestBed.inject(SuggestFlashcardsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends only suggestion inputs and never a caller-controlled user id', async () => {
    const responsePromise = service.suggestFromMessage('Bonjour le monde', 'fr', true, 12);

    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/flashcards/suggest`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    expect(request.request.params.get('message')).toBe('Bonjour le monde');
    expect(request.request.params.get('target_language')).toBe('fr');
    expect(request.request.params.get('exclude_known')).toBe('true');
    expect(request.request.params.get('max_results')).toBe('12');
    expect(request.request.params.has('user_id')).toBe(false);

    request.flush({ suggestions: ['bonjour', 'monde'] });
    await expect(responsePromise).resolves.toEqual({ suggestions: ['bonjour', 'monde'] });
  });

  it('defaults to excluding mastered words', async () => {
    const responsePromise = service.suggestFromMessage('hello world');

    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/flashcards/suggest`,
    );
    expect(request.request.params.get('exclude_known')).toBe('true');
    expect(request.request.params.has('target_language')).toBe(false);
    expect(request.request.params.has('max_results')).toBe(false);

    request.flush({ suggestions: ['hello', 'world'] });
    await expect(responsePromise).resolves.toEqual({ suggestions: ['hello', 'world'] });
  });
});
