import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { LessonsService } from './lessons.service';

const lesson = {
  id: 'lesson-1',
  title: 'Greetings',
  language_code: 'ja',
  progress: {
    progress_percent: 0,
    last_position: 0,
    completed: false,
    completed_at: null,
  },
};

describe('LessonsService', () => {
  let service: LessonsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LessonsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getBearerHeaders: () => new HttpHeaders({ Authorization: 'Bearer test-token' }),
          },
        },
      ],
    });

    service = TestBed.inject(LessonsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the authenticated lesson catalogue with an optional language filter', async () => {
    const promise = service.listLessons('ja');

    const request = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/lessons` && req.params.get('language') === 'ja',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([lesson]);

    await expect(promise).resolves.toEqual([lesson]);
  });

  it('loads a lesson by deep-link id', async () => {
    const promise = service.getLesson('lesson-1');

    const request = http.expectOne(`${environment.apiUrl}/lessons/lesson-1`);
    expect(request.request.method).toBe('GET');
    request.flush(lesson);

    await expect(promise).resolves.toEqual(lesson);
  });

  it('persists resumable progress with PUT semantics', async () => {
    const promise = service.updateProgress('lesson-1', {
      progressPercent: 50,
      lastPosition: 2,
    });

    const request = http.expectOne(`${environment.apiUrl}/lessons/lesson-1/progress`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      progressPercent: 50,
      lastPosition: 2,
    });
    request.flush({
      progress_percent: 50,
      last_position: 2,
      completed: false,
      completed_at: null,
    });

    await expect(promise).resolves.toEqual({
      progress_percent: 50,
      last_position: 2,
      completed: false,
      completed_at: null,
    });
  });
});
