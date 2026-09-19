import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { DiagnosticQuizResult, QuizQuestion } from '../../services/quiz.service';
import { QuizService } from '../../services/quiz.service';
import { DiagnosticQuizComponent } from './diagnostic-quiz.component';

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    text: 'How well can you introduce yourself?',
    skill: 'speaking',
    category: 'self_assessment',
    options: [
      { id: 'low', text: 'I struggle.' },
      { id: 'high', text: 'I can do it fluently.' },
    ],
  },
  {
    id: 'q2',
    text: 'How well can you understand speech?',
    skill: 'listening',
    category: 'comprehension',
    options: [
      { id: 'low', text: 'Not well.' },
      { id: 'high', text: 'Very well.' },
    ],
  },
];

const result: DiagnosticQuizResult = {
  score: 5,
  maxScore: 8,
  percentage: 63,
  suggestedCefr: 'B2',
  skillBreakdown: {
    speaking: { score: 4, max: 4, percentage: 100 },
    listening: { score: 1, max: 4, percentage: 25 },
  },
  description: 'Upper Intermediate',
};

describe('DiagnosticQuizComponent completion contract', () => {
  let fixture: ComponentFixture<DiagnosticQuizComponent>;
  let component: DiagnosticQuizComponent;
  let quizService: {
    getQuestions: ReturnType<typeof vi.fn>;
    submitResults: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    quizService = {
      getQuestions: vi.fn().mockResolvedValue(questions),
      submitResults: vi.fn().mockResolvedValue(result),
    };

    await TestBed.configureTestingModule({
      imports: [DiagnosticQuizComponent],
      providers: [provideHttpClient(), { provide: QuizService, useValue: quizService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagnosticQuizComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function answerAllQuestions(): void {
    component.selectOption('q1', 'high');
    component.next();
    component.selectOption('q2', 'low');
  }

  it('prevents duplicate submissions while completion is pending', async () => {
    let resolveSubmit!: (value: DiagnosticQuizResult) => void;
    quizService.submitResults.mockImplementationOnce(
      () =>
        new Promise<DiagnosticQuizResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    answerAllQuestions();

    component.next();
    component.next();

    expect(component.isSubmitting()).toBe(true);
    expect(quizService.submitResults).toHaveBeenCalledTimes(1);
    expect(quizService.submitResults).toHaveBeenCalledWith({
      targetLanguage: 'en',
      answers: { q1: 'high', q2: 'low' },
    });

    resolveSubmit(result);
    await fixture.whenStable();
    expect(component.isSubmitting()).toBe(false);
  });

  it('can retry a failed completion without losing valid answers', async () => {
    quizService.submitResults.mockRejectedValueOnce(new Error('temporarily unavailable'));
    let emitted: DiagnosticQuizResult | null = null;
    component.quizCompleted.subscribe((value) => (emitted = value));
    answerAllQuestions();

    component.next();
    await fixture.whenStable();

    expect(component.submitError()).toBe(true);
    expect(component.answers()).toEqual({ q1: 'high', q2: 'low' });
    expect(emitted).toBeNull();

    component.next();
    await fixture.whenStable();

    expect(quizService.submitResults).toHaveBeenCalledTimes(2);
    expect(component.submitError()).toBe(false);
    expect(emitted).toEqual(result);
  });

  it('keeps progress semantics bounded and tied to the visible question', () => {
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]');

    expect(component.currentQuestionNumber()).toBe(1);
    expect(component.progressPercentage()).toBe(0);
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect(progress.getAttribute('aria-valuenow')).toBe('0');

    component.selectOption('q1', 'high');
    component.next();
    fixture.detectChanges();

    expect(component.currentQuestionNumber()).toBe(2);
    expect(component.progressPercentage()).toBe(50);
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
  });
});
