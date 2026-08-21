import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslatePipe } from '../../services/translate.pipe';
import { DiagnosticQuizComponent } from './diagnostic-quiz.component';

describe('DiagnosticQuizComponent', () => {
  let component: DiagnosticQuizComponent;
  let fixture: ComponentFixture<DiagnosticQuizComponent>;
  let httpTesting: HttpTestingController;

  const mockQuestions = [
    {
      id: 'q1',
      text: 'How well can you introduce yourself?',
      options: [
        { id: 'o1', text: 'I struggle.', points: 1 },
        { id: 'o2', text: 'I can do it slowly.', points: 2 },
        { id: 'o3', text: 'I can do it easily.', points: 3 },
        { id: 'o4', text: 'I can do it fluently.', points: 4 },
      ],
    },
    {
      id: 'q2',
      text: 'How well can you understand speech?',
      options: [
        { id: 'o1', text: 'Not well.', points: 1 },
        { id: 'o2', text: 'Reasonably well.', points: 2 },
        { id: 'o3', text: 'Very well.', points: 3 },
        { id: 'o4', text: 'Perfectly.', points: 4 },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagnosticQuizComponent, TranslatePipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagnosticQuizComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    expect(component).toBeTruthy();
  });

  it('should show loading state initially', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
  });

  it('should render quiz content after questions load', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.questions().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('How well can you introduce yourself?');
  });

  it('should expose each question as one labelled Spartan radio group', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('hlm-radio-group');
    expect(group).toBeTruthy();
    expect(group.getAttribute('aria-labelledby')).toBe('diagnostic-question-0');
    expect(group.querySelectorAll('hlm-radio').length).toBe(4);
    expect(group.querySelector('[aria-pressed]')).toBeNull();
  });

  it('should store numeric values emitted by the Spartan radio group', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('hlm-radio-group');
    expect(group.querySelectorAll('hlm-radio').length).toBe(4);

    component.selectOption('q1', 2);
    fixture.detectChanges();

    expect(component.answers()).toEqual({ q1: 2 });
    expect(component.canProceed()).toBe(true);
  });

  it('should ignore malformed non-numeric answer values', () => {
    component.selectOption('q1', '2');
    component.selectOption('q1', Number.NaN);

    expect(component.answers()).toEqual({});
  });

  it('should show error state when API fails', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.error(new ErrorEvent('Network error'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('should show empty state when no questions returned', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.questions().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No questions available');
  });

  it('should navigate to next question', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(0);

    component.selectOption('q1', 2);
    component.next();
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(1);
  });

  it('should guard against proceeding without selection in next()', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.canProceed()).toBe(false);
    component.next();
    expect(component.currentIndex()).toBe(0);
  });

  it('should enable next button after selecting an option', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectOption('q1', 2);
    fixture.detectChanges();

    expect(component.canProceed()).toBe(true);
  });

  it('should navigate to previous question', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectOption('q1', 2);
    component.next();
    fixture.detectChanges();
    expect(component.currentIndex()).toBe(1);

    component.previous();
    fixture.detectChanges();
    expect(component.currentIndex()).toBe(0);
  });

  it('should not go back from first question', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.isFirstQuestion()).toBe(true);
    component.previous();
    expect(component.currentIndex()).toBe(0);
  });

  it('should emit quizCompleted on finish', async () => {
    let emitted: { score: number; suggestedLevel: string; maxScore: number } | null = null;
    component.quizCompleted.subscribe((v) => (emitted = v));

    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectOption('q1', 3);
    component.next();
    fixture.detectChanges();

    component.selectOption('q2', 2);
    fixture.detectChanges();

    expect(component.isLastQuestion()).toBe(true);
    component.next();

    const resultsReq = httpTesting.expectOne('/api/quiz/results');
    resultsReq.flush({ received: true });
    await fixture.whenStable();

    expect(emitted).toBeTruthy();
    expect(emitted!.score).toBe(5);
  });

  it('should compute progress percentage', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.progressPercentage()).toBe(0);
    component.selectOption('q1', 1);
    component.next();
    fixture.detectChanges();
    expect(component.progressPercentage()).toBe(50);
  });

  it('should compute correct progress bar attributes', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('should reload questions and reset state', async () => {
    fixture.detectChanges();
    const req1 = httpTesting.expectOne('/api/quiz/questions?language=en');
    req1.flush(mockQuestions);
    await fixture.whenStable();

    component.selectOption('q1', 2);
    component.next();
    fixture.detectChanges();
    expect(component.currentIndex()).toBe(1);

    component.reloadQuestions();
    fixture.detectChanges();
    const req2 = httpTesting.expectOne('/api/quiz/questions?language=en');
    req2.flush(mockQuestions);
    await fixture.whenStable();

    expect(component.currentIndex()).toBe(0);
    expect(component.answers()).toEqual({});
  });

  it('should suggest correct CEFR levels based on score percentage', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    let emitted: { suggestedLevel: string } | null = null;
    component.quizCompleted.subscribe((v) => (emitted = v));

    // Score 8/8 = 100% >= 90% → C2
    component.selectOption('q1', 4);
    component.next();
    fixture.detectChanges();
    component.selectOption('q2', 4);
    fixture.detectChanges();
    component.next();

    const resultsReq = httpTesting.expectOne('/api/quiz/results');
    resultsReq.flush({ received: true });
    await fixture.whenStable();

    expect(emitted!.suggestedLevel).toBe('C2');
  });

  it('should handle submit results API failure gracefully', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('/api/quiz/questions?language=en');
    req.flush(mockQuestions);
    await fixture.whenStable();
    fixture.detectChanges();

    let emitted: { suggestedLevel: string } | null = null;
    component.quizCompleted.subscribe((v) => (emitted = v));

    component.selectOption('q1', 3);
    component.next();
    fixture.detectChanges();
    component.selectOption('q2', 2);
    fixture.detectChanges();
    component.next();

    const resultsReq = httpTesting.expectOne('/api/quiz/results');
    resultsReq.error(new ErrorEvent('Network error'));
    await fixture.whenStable();

    expect(emitted).toBeTruthy();
  });
});
