import { Component, computed, output, signal, inject, resource } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../../services/quiz.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { showToast } from '../../services/toast.service';

@Component({
  selector: 'app-diagnostic-quiz',
  imports: [TranslatePipe],
  templateUrl: './diagnostic-quiz.component.html',
})
export class DiagnosticQuizComponent {
  private quizService = inject(QuizService);
  private i18n = inject(I18nService);
  private router = inject(Router);

  quizCompleted = output<{ score: number; suggestedLevel: string; maxScore: number }>();

  currentIndex = signal<number>(0);
  answers = signal<Record<string, number>>({});
  isSubmitting = signal<boolean>(false);
  finalResult = signal<{ score: number; suggestedLevel: string; maxScore: number } | null>(null);

  private loadingLanguage = signal<string>('en');

  questionsResource = resource({
    params: () => ({ language: this.loadingLanguage() }),
    loader: async ({ params }) => {
      return await this.quizService.getQuestions(params.language);
    },
    defaultValue: [],
  });

  readonly questions = computed(() => this.questionsResource.value());
  readonly loading = computed(() => this.questionsResource.isLoading());
  readonly error = computed(() => this.questionsResource.error());

  readonly currentQuestion = computed(() => {
    const qs = this.questions();
    const idx = this.currentIndex();
    return idx >= 0 && idx < qs.length ? qs[idx] : null;
  });

  readonly progressPercentage = computed(() => {
    const qs = this.questions();
    if (qs.length === 0) return 0;
    return (this.currentIndex() / qs.length) * 100;
  });

  readonly isLastQuestion = computed(() => {
    const qs = this.questions();
    if (qs.length === 0) return false;
    return this.currentIndex() === qs.length - 1;
  });

  readonly isFirstQuestion = computed(() => this.currentIndex() === 0);

  readonly canProceed = computed(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    return this.answers()[q.id] !== undefined;
  });

  readonly currentQuestionNumber = computed(() => this.currentIndex() + 1);

  readonly totalQuestions = computed(() => this.questions().length);

  readonly hasResult = computed(() => this.finalResult() !== null);

  readonly cefrColour = computed(() => {
    const level = this.finalResult()?.suggestedLevel;
    if (!level) return 'bg-surface-200 text-text-secondary';
    const colours: Record<string, string> = {
      'A1': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'A2': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      'B1': 'bg-green-500/20 text-green-300 border-green-500/30',
      'B2': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'C1': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'C2': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    };
    return colours[level] ?? colours['A1'];
  });

  reloadQuestions(language: string): void {
    this.loadingLanguage.set(language);
    this.currentIndex.set(0);
    this.answers.set({});
    this.finalResult.set(null);
    this.questionsResource.reload();
  }

  selectOption(questionId: string, points: number): void {
    this.answers.update((prev) => ({ ...prev, [questionId]: points }));
  }

  next(): void {
    if (!this.canProceed()) return;
    if (this.isLastQuestion()) {
      this.finishQuiz();
    } else {
      this.currentIndex.update((i) => i + 1);
    }
  }

  previous(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  continueAfterResult(): void {
    const result = this.finalResult();
    if (result) {
      this.quizCompleted.emit(result);
    }
    this.router.navigate(['/']);
  }

  private async finishQuiz(): Promise<void> {
    this.isSubmitting.set(true);
    const totalScore = Object.values(this.answers()).reduce((sum, pts) => sum + pts, 0);
    const totalQuestions = this.questions().length;
    const maxScore = totalQuestions * 3;
    const percentage = maxScore > 0 ? totalScore / maxScore : 0;

    let suggestedLevel = 'A1';

    if (percentage >= 0.9) suggestedLevel = 'C2';
    else if (percentage >= 0.8) suggestedLevel = 'C1';
    else if (percentage >= 0.65) suggestedLevel = 'B2';
    else if (percentage >= 0.5) suggestedLevel = 'B1';
    else if (percentage >= 0.3) suggestedLevel = 'A2';

    try {
      await this.quizService.submitResults({
        score: totalScore,
        maxScore,
        suggestedLevel,
        answers: this.answers(),
      });
    } catch {
      showToast(this.i18n.translate('diagnosticQuiz.submitError'), 'error');
    } finally {
      this.isSubmitting.set(false);
    }

    this.finalResult.set({ score: totalScore, suggestedLevel, maxScore });
  }
}
