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

describe('DiagnosticQuizComponent', () => {
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
      providers: [
        provideHttpClient(),
        { provide: QuizService, useValue: quizService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagnosticQuizComponent);
    component = fixture.componentInstance;
  });

  async function load(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads a target-language question set and exposes one labelled radio group', async () => {
    await load();

    expect(quizService.getQuestions).toHaveBeenCalledWith('en');
    expect(component.questions()).toHaveLength(2);
    const group = fixture.nativeElement.querySelector('hlm-radio-group');
    expect(group.getAttribute('aria-labelledby')).toBe('diagnostic-question-0');
    expect(group.querySelectorAll('hlm-radio')).toHaveLength(2);
  });

  it('uses Relay semantic surface, radius, border, and elevation roles', async () => {
    await load();

    const surface: HTMLElement = fixture.nativeElement.querySelector('section');
    const counter: HTMLElement = surface.querySelector('span.rounded-pill');
    const progress: HTMLElement = surface.querySelector('[role="progressbar"]');
    const progressFill: HTMLElement = progress.firstElementChild as HTMLElement;
    const option: HTMLElement = surface.querySelector('hlm-radio');

    expect(surface.classList.toString()).toContain('rounded-card');
    expect(surface.classList.toString()).toContain('border-surface-100');
    expect(surface.classList.toString()).toContain('bg-surface-200');
    expect(surface.classList.toString()).toContain('shadow-card');
    expect(surface.classList.toString()).not.toContain('rounded-sheet');
    expect(surface.classList.toString()).not.toContain('border-primary/20');

    expect(counter.classList.toString()).toContain('rounded-pill');
    expect(counter.classList.toString()).not.toContain('rounded-full');
    expect(progress.classList.toString()).toContain('rounded-pill');
    expect(progress.classList.toString()).toContain('bg-surface-300');
    expect(progressFill.classList.toString()).toContain('rounded-pill');

    expect(option.classList.toString()).toContain('rounded-card');
    expect(option.classList.toString()).toContain('border-surface-100');
    expect(option.classList.toString()).toContain('bg-surface-300');
    expect(option.classList.toString()).toContain('data-[checked=true]:border-primary');
    expect(option.classList.toString()).not.toContain('rounded-2xl');
    expect(option.classList.toString()).not.toContain('bg-surface-400');
  });

  it('uses a mobile-first layout that expands at the small breakpoint', async () => {
    await load();

    const surface: HTMLElement = fixture.nativeElement.querySelector('section');
    const headerRow: HTMLElement = surface.querySelector('div.mb-4');
    const footer: HTMLElement = surface.querySelector('div.border-t');
    const actionRow: HTMLElement = footer.querySelector('div.flex');
    const buttons: NodeListOf<HTMLButtonElement> = actionRow.querySelectorAll('button');

    expect(headerRow.classList.toString()).toContain('flex-col');
    expect(headerRow.classList.toString()).toContain('sm:flex-row');
    expect(actionRow.classList.toString()).toContain('flex-col');
    expect(actionRow.classList.toString()).toContain('sm:flex-row');

    for (const button of buttons) {
      expect(button.classList.toString()).toContain('w-full');
      expect(button.classList.toString()).toContain('sm:w-auto');
    }
  });

  it('keeps option content wrap-safe while preserving a circular index marker', async () => {
    await load();

    const option: HTMLElement = fixture.nativeElement.querySelector('hlm-radio');
    const content: HTMLElement = option.querySelector('span.flex');
    const marker: HTMLElement = content.firstElementChild as HTMLElement;
    const label: HTMLElement = content.lastElementChild as HTMLElement;

    expect(content.classList.toString()).toContain('min-w-0');
    expect(content.classList.toString()).toContain('items-start');
    expect(marker.classList.toString()).toContain('shrink-0');
    expect(marker.classList.toString()).toContain('rounded-full');
    expect(label.classList.toString()).toContain('min-w-0');
    expect(label.classList.toString()).toContain('flex-1');
  });

  it('stores opaque option identifiers rather than client-visible point values', async () => {
    await load();

    component.selectOption('q1', 'high');
    expect(component.answers()).toEqual({ q1: 'high' });
    expect(component.canProceed()).toBe(true);
  });

  it('ignores unknown, non-string, and cross-question option values', async () => {
    await load();

    component.selectOption('q1', 4);
    component.selectOption('q1', 'forged');
    component.selectOption('missing', 'high');
    expect(component.answers()).toEqual({});
  });

  it('preserves answers while moving backwards and forwards', async () => {
    await load();

    component.selectOption('q1', 'high');
    component.next();
    expect(component.currentIndex()).toBe(1);
    component.previous();
    expect(component.currentIndex()).toBe(0);
    expect(component.answers()).toEqual({ q1: 'high' });
  });

  it('does not advance an unanswered question', async () => {
    await load();
    component.next();
    expect(component.currentIndex()).toBe(0);
  });

  it('submits answer ids and emits only the server-authoritative result', async () => {
    let emitted: DiagnosticQuizResult | null = null;
    component.quizCompleted.subscribe((value) => (emitted = value));
    await load();

    component.selectOption('q1', 'high');
    component.next();
    component.selectOption('q2', 'low');
    component.next();
    await fixture.whenStable();

    expect(quizService.submitResults).toHaveBeenCalledWith({
      targetLanguage: 'en',
      answers: { q1: 'high', q2: 'low' },
    });
    expect(emitted).toEqual(result);
  });

  it('fails closed when result persistence fails', async () => {
    quizService.submitResults.mockRejectedValueOnce(new Error('offline'));
    let emitted: DiagnosticQuizResult | null = null;
    component.quizCompleted.subscribe((value) => (emitted = value));
    await load();

    component.selectOption('q1', 'high');
    component.next();
    component.selectOption('q2', 'low');
    component.next();
    await fixture.whenStable();

    expect(component.submitError()).toBe(true);
    expect(component.isSubmitting()).toBe(false);
    expect(emitted).toBeNull();
  });

  it('resets stale answers when the target language changes', async () => {
    await load();
    component.selectOption('q1', 'high');
    expect(component.answers()).toEqual({ q1: 'high' });

    fixture.componentRef.setInput('targetLanguage', 'ja');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(quizService.getQuestions).toHaveBeenCalledWith('ja');
    expect(component.answers()).toEqual({});
    expect(component.currentIndex()).toBe(0);
  });

  it('shows retryable load and empty states', async () => {
    quizService.getQuestions.mockRejectedValueOnce(new Error('unavailable'));
    await load();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    quizService.getQuestions.mockResolvedValueOnce([]);
    component.reloadQuestions();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.questions()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No questions available');
  });
});
