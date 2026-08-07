import { Component, computed, output, signal, inject, resource } from '@angular/core';
import { QuizService } from '../../services/quiz.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { showToast } from '../../services/toast.service';

@Component({
  selector: 'app-diagnostic-quiz',
  imports: [TranslatePipe],
  template: `
    <!-- Loading State -->
    @if (loading()) {
      <div class="flex flex-col items-center justify-center p-12" role="status" aria-label="{{ 'diagnosticQuiz.loading' | t }}">
        <div class="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mb-4"></div>
        <p class="text-purple-300/70 text-sm">{{ 'diagnosticQuiz.loading' | t }}</p>
      </div>
    }

    <!-- Error State -->
    @if (error()) {
      <div class="text-center p-12" role="alert">
        <span class="text-5xl block mb-4">&#x26A0;&#xFE0F;</span>
        <h3 class="text-xl font-semibold text-purple-200 mb-2">{{ 'diagnosticQuiz.errorTitle' | t }}</h3>
        <p class="text-purple-300/60 text-sm mb-6">{{ 'diagnosticQuiz.errorDescription' | t }}</p>
        <button
          type="button"
          (click)="reloadQuestions('en')"
          class="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
        >
          {{ 'diagnosticQuiz.retry' | t }}
        </button>
      </div>
    }

    <!-- Quiz Content -->
    @if (!loading() && !error() && questions().length > 0) {
      <div
        class="w-full max-w-3xl mx-auto bg-[#1a1a2e] rounded-[2rem] border border-purple-500/20 overflow-hidden"
        role="region"
        aria-label="{{ 'diagnosticQuiz.title' | t }}"
      >
        <!-- Header & Progress -->
        <div class="ps-6 pe-6 pt-6 pb-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-purple-100 text-start">
              {{ 'diagnosticQuiz.title' | t }}
            </h2>
            <span class="text-sm text-purple-300/50 bg-purple-500/10 px-3 py-1 rounded-full text-end">
              {{ 'diagnosticQuiz.questionCounter' | t: { current: currentQuestionNumber(), total: totalQuestions() } }}
            </span>
          </div>
          <div class="w-full bg-[#0f0f23] rounded-full h-2 overflow-hidden" role="progressbar" [attr.aria-valuenow]="progressPercentage()" aria-valuemin="0" aria-valuemax="100">
            <div
              class="h-2 rounded-full transition-all duration-500 ease-out"
              [style.width.%]="progressPercentage()"
              style="background: linear-gradient(90deg, #a855f7, #ec4899); box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);"
            ></div>
          </div>
        </div>

        <!-- Question Area -->
        <div class="ps-6 pe-6 pb-6 min-h-[220px]">
          @if (currentQuestion(); as q) {
            <h3 class="text-lg font-medium text-purple-100 mb-6 text-start leading-relaxed">
              {{ q.text }}
            </h3>

            <div class="flex flex-col gap-3">
              @for (option of q.options; track option.id; let idx = $index) {
                @let isSelected = answers()[q.id] === option.points;
                <button
                  type="button"
                  (click)="selectOption(q.id, option.points)"
                  class="w-full text-start ps-5 pe-5 pt-4 pb-4 rounded-2xl border-2 transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a2e]"
                  [class.border-purple-400]="isSelected"
                  [class.border-purple-500/20]="!isSelected"
                  [class.shadow-lg]="isSelected"
                  [class.shadow-purple-500/20]="isSelected"
                  [attr.aria-pressed]="isSelected"
                  [attr.aria-label]="'diagnosticQuiz.optionLabel' | t: { number: idx + 1, text: option.text }"
                  [style.background]="isSelected ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.1))' : 'rgba(15,15,35,0.6)'"
                >
                  <span
                    class="text-base font-medium block"
                    [class.text-purple-100]="isSelected"
                    [class.text-purple-300/70]="!isSelected"
                  >
                    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full me-3 text-sm font-bold"
                      [class.bg-purple-500]="isSelected"
                      [class.text-white]="isSelected"
                      [class.bg-purple-500/10]="!isSelected"
                      [class.text-purple-300/60]="!isSelected"
                    >{{ idx + 1 }}</span>
                    {{ option.text }}
                  </span>
                </button>
              }
            </div>
          }
        </div>

        <!-- Navigation Actions -->
        <div class="flex items-center justify-between ps-6 pe-6 pt-4 pb-6 bg-[#0f0f23]/60 border-t border-purple-500/10">
          <button
            type="button"
            (click)="previous()"
            [disabled]="isFirstQuestion()"
            class="px-6 py-3 text-sm font-medium text-purple-300/80 bg-purple-500/10 rounded-xl hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            {{ 'diagnosticQuiz.previous' | t }}
          </button>

          @if (isLastQuestion()) {
            <button
              type="button"
              (click)="next()"
              [disabled]="!canProceed() || isSubmitting()"
              class="px-8 py-3 text-sm font-bold text-white rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a2e]"
              style="background: linear-gradient(135deg, #a855f7, #ec4899); box-shadow: 0 4px 24px rgba(168, 85, 247, 0.3);"
              [style.opacity]="(!canProceed() || isSubmitting()) ? '0.5' : '1'"
            >
              @if (isSubmitting()) {
                <span class="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2 align-middle"></span>
              }
              {{ 'diagnosticQuiz.submit' | t }}
            </button>
          } @else {
            <button
              type="button"
              (click)="next()"
              [disabled]="!canProceed()"
              class="px-6 py-3 text-sm font-medium text-purple-100 bg-purple-600 rounded-xl hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              {{ 'diagnosticQuiz.next' | t }}
            </button>
          }
        </div>
      </div>
    }

    <!-- Empty State (loaded but no questions) -->
    @if (!loading() && !error() && questions().length === 0) {
      <div class="text-center p-12" role="status">
        <span class="text-5xl block mb-4">&#x1F4CB;</span>
        <p class="text-purple-300/60 text-sm">{{ 'diagnosticQuiz.empty' | t }}</p>
      </div>
    }
  `,
})
export class DiagnosticQuizComponent {
  private quizService = inject(QuizService);
  private i18n = inject(I18nService);

  quizCompleted = output<{ score: number; suggestedLevel: string; maxScore: number }>();

  currentIndex = signal<number>(0);
  answers = signal<Record<string, number>>({});
  isSubmitting = signal<boolean>(false);

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

  reloadQuestions(language: string): void {
    this.loadingLanguage.set(language);
    this.currentIndex.set(0);
    this.answers.set({});
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

    this.quizCompleted.emit({ score: totalScore, suggestedLevel, maxScore });
  }
}
