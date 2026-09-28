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

  it('loads authenticated resumable progress', async () => {
    const resultPromise = firstValueFrom(service.getLessonProgress('lesson/one'));
    const request = httpMock.expectOne(
      `${environment.apiUrl}/lessons/lesson%2Fone/progress`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer lesson-token');
    request.flush({
      lesson_id: 'lesson/one',
      segment_index: 2,
      completed: false,
      completed_at: null,
      updated_at: '2026-08-26T20:00:00.000Z',
    });

    await expect(resultPromise).resolves.toMatchObject({ segment_index: 2 });
  });

  it('persists progress through the authenticated idempotent endpoint', async () => {
    const resultPromise = firstValueFrom(
      service.saveLessonProgress('lesson-1', {
        segment_index: 3,
        completed: true,
      }),
    );
    const request = httpMock.expectOne(`${environment.apiUrl}/lessons/lesson-1/progress`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Authorization')).toBe('Bearer lesson-token');
    expect(request.request.body).toEqual({ segment_index: 3, completed: true });
    request.flush({
      lesson_id: 'lesson-1',
      segment_index: 3,
      completed: true,
      completed_at: '2026-08-26T20:01:00.000Z',
      updated_at: '2026-08-26T20:01:00.000Z',
    });

    await expect(resultPromise).resolves.toMatchObject({ completed: true });
  });

  it('fails closed before making a request when there is no access token', () => {
    auth.getAccessToken.mockReturnValue(null);

    expect(() => service.getLessons()).toThrow('Authentication required to load lessons');
    expect(() => service.getLessonProgress('lesson-1')).toThrow(
      'Authentication required to load lessons',
    );
    httpMock.expectNone(`${environment.apiUrl}/lessons`);
  });

  it('propagates API failures instead of returning fabricated lessons', async () => {
    const resultPromise = firstValueFrom(service.getLessons());
    const request = httpMock.expectOne(`${environment.apiUrl}/lessons`);
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Unavailable' });

    await expect(resultPromise).rejects.toMatchObject({ status: 503 });
  });
});
