import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { LessonsService } from './lessons.service';

describe('LessonsService', () => {
  let service: LessonsService;
  let httpMock: HttpTestingController;
  const auth = { getAccessToken: vi.fn().mockReturnValue('lesson-token') };

  beforeEach(() => {
    auth.getAccessToken.mockReturnValue('lesson-token');
    TestBed.configureTestingModule({
      providers: [
        LessonsService,
        { provide: AuthService, useValue: auth },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LessonsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the authenticated learner lesson list', async () => {
    const resultPromise = firstValueFrom(service.getLessons());
    const request = httpMock.expectOne(`${environment.apiUrl}/lessons`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer lesson-token');
    request.flush([{ id: 'lesson-1', title: 'Greetings', language_code: 'ja' }]);

    await expect(resultPromise).resolves.toEqual([
      { id: 'lesson-1', title: 'Greetings', language_code: 'ja' },
    ]);
  });

  it('encodes lesson identifiers before requesting details', async () => {
    const resultPromise = firstValueFrom(service.getLesson('lesson/with spaces'));
    const request = httpMock.expectOne(
      `${environment.apiUrl}/lessons/lesson%2Fwith%20spaces`,
    );

    expect(request.request.method).toBe('GET');
    request.flush({ id: 'lesson/with spaces', title: 'Lesson', language_code: 'es' });

    await expect(resultPromise).resolves.toMatchObject({ id: 'lesson/with spaces' });
  });

  it('fails closed before making a request when there is no access token', () => {
    auth.getAccessToken.mockReturnValue(null);

    expect(() => service.getLessons()).toThrow('Authentication required to load lessons');
    httpMock.expectNone(`${environment.apiUrl}/lessons`);
  });

  it('propagates API failures instead of returning fabricated lessons', async () => {
    const resultPromise = firstValueFrom(service.getLessons());
    const request = httpMock.expectOne(`${environment.apiUrl}/lessons`);
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Unavailable' });

    await expect(resultPromise).rejects.toMatchObject({ status: 503 });
  });
});
