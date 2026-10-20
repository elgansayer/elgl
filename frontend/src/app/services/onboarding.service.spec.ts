import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { DiagnosticQuizResult } from './quiz.service';
import { OnboardingService } from './onboarding.service';

const result: DiagnosticQuizResult = {
  score: 25,
  maxScore: 40,
  percentage: 63,
  suggestedCefr: 'B2',
  skillBreakdown: {},
  description: 'Upper Intermediate',
};

describe('OnboardingService diagnostic step', () => {
  let service: OnboardingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(OnboardingService);
  });

  it('places the diagnostic between target language and display name', () => {
    expect(service.steps.map((step) => step.label)).toEqual([
      'onboarding.step1',
      'onboarding.step2',
      'diagnosticQuiz.title',
      'onboarding.step4',
    ]);
  });

  it('cannot leave the diagnostic step until a server result is recorded', () => {
    service.setNativeLanguage('en');
    service.nextStep();
    service.toggleTargetLanguage('ja');
    service.nextStep();

    expect(service.currentStep()).toBe(2);
    expect(service.canGoNext()).toBe(false);
    service.nextStep();
    expect(service.currentStep()).toBe(2);

    service.setQuizResult(result);
    expect(service.canGoNext()).toBe(true);
    service.nextStep();
    expect(service.currentStep()).toBe(3);
  });

  it('uses the first selected target language as the diagnostic context', () => {
    service.toggleTargetLanguage('ja');
    service.toggleTargetLanguage('es');
    expect(service.primaryTargetLanguage()).toBe('ja');
  });

  it('invalidates a result when target-language selection changes', () => {
    service.toggleTargetLanguage('ja');
    service.setQuizResult(result);
    expect(service.quizResult()).toEqual(result);

    service.toggleTargetLanguage('es');
    expect(service.quizResult()).toBeNull();
  });
});
