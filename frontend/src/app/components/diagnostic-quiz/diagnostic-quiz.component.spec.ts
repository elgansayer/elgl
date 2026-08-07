import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, Component, input, output } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagnosticQuizComponent } from './diagnostic-quiz.component';
import { QuizService, QuizQuestion, QuizResultResponse } from '../../services/quiz.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-card',
  template: '<ng-content />',
  host: { '[class]': "'rounded-2xl'" },
})
class MockAppCardComponent {
  readonly customClass = input('');
}

@Component({
  selector: 'app-button-primary',
  template: '<button (click)="onClick($event)"><ng-content /></button>',
})
class MockAppButtonPrimaryComponent {
  readonly disabled = input(false);
  readonly size = input('md');
  readonly clicked = output<MouseEvent>();
  onClick(event: MouseEvent): void { this.clicked.emit(event); }
}

@Component({
  selector: 'app-button-secondary',
  template: '<button (click)="onClick($event)"><ng-content /></button>',
})
class MockAppButtonSecondaryComponent {
  readonly disabled = input(false);
  readonly size = input('md');
  readonly clicked = output<MouseEvent>();
  onClick(event: MouseEvent): void { this.clicked.emit(event); }
}

@Pipe({ name: 'keyvalue' })
class MockKeyValuePipe implements PipeTransform {
  transform(value: Record<string, unknown> | null | undefined): Array<{ key: string; value: unknown }> {
    if (!value) return [];
    return Object.entries(value).map(([key, val]) => ({ key, value: val }));
  }
}

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

const mockQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    text: 'How well can you introduce yourself?',
    skill: 'speaking',
    category: 'self_assessment',
    options: [
      { id: 'q1_a', text: 'I struggle', points: 1 },
      { id: 'q1_b', text: 'I can manage', points: 2 },
      { id: 'q1_c', text: 'I can do it easily', points: 3 },
    ],
  },
  {
    id: 'q2',
    text: 'How well can you read?',
    skill: 'reading',
    category: 'comprehension',
    options: [
      { id: 'q2_a', text: 'Barely', points: 1 },
      { id: 'q2_b', text: 'Moderately', points: 2 },
    ],
  },
];

const mockResult: QuizResultResponse = {
  totalScore: 6,
  maxScore: 8,
  percentage: 75,
  suggestedCefr: 'B2',
  skillBreakdown: {
    speaking: { score: 3, max: 4 },
    reading: { score: 3, max: 4 },
  },
  description: 'Upper Intermediate',
};

describe('DiagnosticQuizComponent', () => {
  let component: DiagnosticQuizComponent;
  let fixture: ComponentFixture<DiagnosticQuizComponent>;
  let quizServiceMock: {
    getQuestions: ReturnType<typeof vi.fn>;
    evaluateResults: ReturnType<typeof vi.fn>;
  };
  let i18nServiceMock: {
    translate: ReturnType<typeof vi.fn>;
  };

  let resolveQuestions!: (value: QuizQuestion[]) => void;
  let resolveEvaluate!: (value: QuizResultResponse) => void;

  beforeEach(async () => {
    quizServiceMock = {
      getQuestions: vi.fn().mockImplementation(
        () => new Promise((r) => { resolveQuestions = r; }),
      ),
      evaluateResults: vi.fn().mockImplementation(
        () => new Promise((r) => { resolveEvaluate = r; }),
      ),
    };
    i18nServiceMock = {
      translate: vi.fn().mockReturnValue('translated'),
    };

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [DiagnosticQuizComponent],
      providers: [
        { provide: QuizService, useValue: quizServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    })
      .overrideComponent(DiagnosticQuizComponent, {
        set: {
          imports: [
            MockAppCardComponent,
            MockAppButtonPrimaryComponent,
            MockAppButtonSecondaryComponent,
            MockTranslatePipe,
            MockKeyValuePipe,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DiagnosticQuizComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function finishLoading(): Promise<void> {
    resolveQuestions(mockQuestions);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show loading skeleton initially', () => {
    expect(component.isLoading()).toBe(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should load questions after deferred resolves', async () => {
    expect(component.isLoading()).toBe(true);
    expect(quizServiceMock.getQuestions).toHaveBeenCalledTimes(1);
    expect(quizServiceMock.getQuestions).toHaveBeenCalledWith('en');

    await finishLoading();

    expect(component.questions()).toEqual(mockQuestions);
    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(false);
  });

  it('should handle load error and allow retry', async () => {
    // First, create a component that will get an error
    TestBed.resetTestingModule();

    const errorMockService = {
      getQuestions: vi.fn().mockRejectedValue(new Error('Network error')),
      evaluateResults: vi.fn().mockResolvedValue(mockResult),
    };

    await TestBed.configureTestingModule({
      imports: [DiagnosticQuizComponent],
      providers: [
        { provide: QuizService, useValue: errorMockService },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    })
      .overrideComponent(DiagnosticQuizComponent, {
        set: {
          imports: [
            MockAppCardComponent,
            MockAppButtonPrimaryComponent,
            MockAppButtonSecondaryComponent,
            MockTranslatePipe,
            MockKeyValuePipe,
          ],
        },
      })
      .compileComponents();

    const errorFixture = TestBed.createComponent(DiagnosticQuizComponent);
    const errorComponent = errorFixture.componentInstance;
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    expect(errorComponent.loadError()).toBe(true);
    expect(errorComponent.isLoading()).toBe(false);

    const el: HTMLElement = errorFixture.nativeElement;
    expect(el.textContent).toContain('quiz.loadError.title');

    // Retry
    errorMockService.getQuestions.mockResolvedValue(mockQuestions);
    await errorComponent.loadQuestions();
    errorFixture.detectChanges();
    await errorFixture.whenStable();
    errorFixture.detectChanges();

    expect(errorComponent.loadError()).toBe(false);
  });

  it('should display current question after loading', async () => {
    await finishLoading();

    const q = component.currentQuestion();
    expect(q?.id).toBe('q1');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('How well can you introduce yourself?');
    expect(el.textContent).toContain('quiz.skill.speaking');
  });

  it('should select an option and enable proceed', async () => {
    await finishLoading();

    component.selectOption('q1', 2);
    fixture.detectChanges();

    expect(component.answers()['q1']).toBe(2);
    expect(component.canProceed()).toBe(true);
  });

  it('should navigate to next question', async () => {
    await finishLoading();

    component.selectOption('q1', 2);
    await component.goNext();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(1);
    expect(component.currentQuestion()?.id).toBe('q2');
  });

  it('should go back to previous question', async () => {
    await finishLoading();

    component.selectOption('q1', 2);
    await component.goNext();
    component.goBack();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(0);
  });

  it('should not go back on first question', async () => {
    await finishLoading();

    component.goBack();
    expect(component.currentIndex()).toBe(0);
  });

  it('should submit quiz on last question and emit result', async () => {
    await finishLoading();

    let emitted: unknown = null;
    component.quizCompleted.subscribe((res) => { emitted = res; });

    // Answer both questions
    component.selectOption('q1', 3);
    await component.goNext();
    fixture.detectChanges();

    component.selectOption('q2', 3);
    expect(component.isLastQuestion()).toBe(true);

    const submitPromise = component.goNext();
    fixture.detectChanges();
    resolveEvaluate(mockResult);
    await submitPromise;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(quizServiceMock.evaluateResults).toHaveBeenCalledWith('en', { q1: 3, q2: 3 });
    expect(component.result()).toEqual(mockResult);
    expect(emitted).toEqual({
      score: 6,
      suggestedCefr: 'B2',
      percentage: 75,
      skillBreakdown: { speaking: { score: 3, max: 4 }, reading: { score: 3, max: 4 } },
    });
  });

  it('should display results screen with skill breakdown', async () => {
    // Simulate result
    component.result.set(mockResult);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('B2');
    expect(el.textContent).toContain('75%');
    expect(el.textContent).toContain('6/8');
    expect(el.textContent).toContain('quiz.skill.speaking');
    expect(el.textContent).toContain('quiz.skill.reading');
  });

  it('should retake quiz from results screen', async () => {
    component.result.set(mockResult);
    fixture.detectChanges();

    component.retake();
    fixture.detectChanges();

    expect(component.result()).toBeNull();
    expect(component.currentIndex()).toBe(0);
    expect(component.answers()).toEqual({});
  });

  it('should handle submission error gracefully', async () => {
    await finishLoading();

    quizServiceMock.evaluateResults.mockRejectedValue(new Error('Server error'));

    component.selectOption('q1', 3);
    await component.goNext();
    component.selectOption('q2', 3);
    await component.goNext();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.result()?.suggestedCefr).toBe('A1');
  });

  it('should show submitting state while evaluating', async () => {
    await finishLoading();

    component.selectOption('q1', 3);
    await component.goNext();
    component.selectOption('q2', 3);

    // Start submission but don't resolve yet
    const submitPromise = component.goNext();
    fixture.detectChanges();

    expect(component.isSubmitting()).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('quiz.submitting');

    resolveEvaluate(mockResult);
    await submitPromise;
  });

  it('should track progress percentage after loading', async () => {
    await finishLoading();

    expect(component.progressPercent()).toBe(50); // 1 of 2 questions

    component.selectOption('q1', 3);
    await component.goNext();
    expect(component.progressPercent()).toBe(100); // 2 of 2
  });
});
