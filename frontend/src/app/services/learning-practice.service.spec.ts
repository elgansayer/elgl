import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { LearningPracticeService } from './learning-practice.service';

describe('LearningPracticeService', () => {
  let service: LearningPracticeService;
  let httpTesting: HttpTestingController;
  const authService = { getAccessToken: vi.fn() };

  beforeEach(() => {
    authService.getAccessToken.mockReset();
    authService.getAccessToken.mockReturnValue('access-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(LearningPracticeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads verb languages with the bearer token', async () => {
    const pending = service.listVerbLanguages();
    const request = httpTesting.expectOne(
      `${environment.apiUrl}/learning/verb-conjugation/languages`,
    );

    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer access-token',
    );
    request.flush([
      { code: 'es', name: 'Spanish', tenses: ['present', 'past'], verbCount: 5 },
    ]);

    await expect(pending).resolves.toHaveLength(1);
  });

  it('requests a verb session with language, tense and limit', async () => {
    const pending = service.getVerbSession('fr', 'past', 3);
    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/learning/verb-conjugation/session`,
    );

    expect(request.request.params.get('language')).toBe('fr');
    expect(request.request.params.get('tense')).toBe('past');
    expect(request.request.params.get('limit')).toBe('3');
    request.flush({
      languageCode: 'fr',
      languageName: 'French',
      tense: 'past',
      exercises: [],
    });

    await expect(pending).resolves.toMatchObject({ languageCode: 'fr' });
  });

  it('posts verb answers to the API', async () => {
    const pending = service.checkVerbAnswer('verb:es:hablar:present:0', 'hablo');
    const request = httpTesting.expectOne(
      `${environment.apiUrl}/learning/verb-conjugation/attempts`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      exerciseId: 'verb:es:hablar:present:0',
      answer: 'hablo',
    });
    request.flush({
      correct: true,
      expected: 'hablo',
      submitted: 'hablo',
      languageCode: 'es',
    });

    await expect(pending).resolves.toMatchObject({ correct: true });
  });

  it('loads IPA languages and a bounded quiz', async () => {
    const pendingLanguages = service.listIpaLanguages();
    const languagesRequest = httpTesting.expectOne(
      `${environment.apiUrl}/learning/ipa-alphabet/languages`,
    );
    languagesRequest.flush([{ code: 'en', name: 'English', phonemeCount: 44 }]);
    await expect(pendingLanguages).resolves.toHaveLength(1);

    const pendingQuiz = service.getIpaQuiz('fr', 4);
    const quizRequest = httpTesting.expectOne(
      (candidate) => candidate.url === `${environment.apiUrl}/learning/ipa-alphabet/quiz`,
    );
    expect(quizRequest.request.params.get('language')).toBe('fr');
    expect(quizRequest.request.params.get('limit')).toBe('4');
    quizRequest.flush({ languageCode: 'fr', languageName: 'French', questions: [] });
    await expect(pendingQuiz).resolves.toMatchObject({ languageCode: 'fr' });
  });

  it('loads the IPA catalogue for a language', async () => {
    const pending = service.getIpaCatalogue('en');
    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/learning/ipa-alphabet/catalogue`,
    );

    expect(request.request.params.get('language')).toBe('en');
    request.flush({ languageCode: 'en', languageName: 'English', phonemes: [] });

    await expect(pending).resolves.toMatchObject({ languageCode: 'en' });
  });

  it('posts IPA answers and reads progress', async () => {
    const pendingAttempt = service.checkIpaAnswer('ipa:en:i-long', 'see');
    const attemptRequest = httpTesting.expectOne(
      `${environment.apiUrl}/learning/ipa-alphabet/attempts`,
    );
    expect(attemptRequest.request.body).toEqual({
      exerciseId: 'ipa:en:i-long',
      answer: 'see',
    });
    attemptRequest.flush({
      correct: false,
      expected: 'see',
      submitted: 'cat',
      languageCode: 'en',
    });
    await expect(pendingAttempt).resolves.toMatchObject({ correct: false });

    const pendingProgress = service.getVerbProgress();
    const progressRequest = httpTesting.expectOne(
      `${environment.apiUrl}/learning/verb-conjugation/progress`,
    );
    progressRequest.flush({
      total: 2,
      correct: 1,
      accuracy: 50,
      byLanguage: [{ languageCode: 'es', total: 2, correct: 1 }],
    });
    await expect(pendingProgress).resolves.toMatchObject({ total: 2 });

    const pendingIpaProgress = service.getIpaProgress();
    const ipaProgressRequest = httpTesting.expectOne(
      `${environment.apiUrl}/learning/ipa-alphabet/progress`,
    );
    ipaProgressRequest.flush({
      total: 1,
      correct: 1,
      accuracy: 100,
      byLanguage: [{ languageCode: 'en', total: 1, correct: 1 }],
    });
    await expect(pendingIpaProgress).resolves.toMatchObject({ accuracy: 100 });
  });
});
