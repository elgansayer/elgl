import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { Component, computed, output, signal, inject, resource, input } from '@angular/core';
import { QuizService } from '../../services/quiz.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { showToast } from '../../services/toast.service';

@Component({
  selector: 'app-diagnostic-quiz',
  imports: [HlmButton, HlmRadioGroup, HlmRadio, TranslatePipe],
  template: `
    <!-- Loading State -->
    @if (loading()) {
      <div
        class="flex flex-col items-center justify-center p-12"
        role="status"
        aria-label="{{ 'diagnosticQuiz.loading' | t }}"
      >
        <div
          class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"
        ></div>
        <p class="text-text-secondary text-sm">{{ 'diagnosticQuiz.loading' | t }}</p>
      </div>
    }

    <!-- Error State -->
    @if (error()) {
      <div class="text-center p-12" role="alert">
        <span class="text-5xl block mb-4">&#x26A0;&#xFE0F;</span>
        <h3 class="text-xl font-semibold text-text-primary mb-2">
          {{ 'diagnosticQuiz.errorTitle' | t }}
        </h3>
        <p class="text-text-muted text-sm mb-6">{{ 'diagnosticQuiz.errorDescription' | t }}</p>
        <button
          hlmBtn
          type="button"
          (click)="reloadQuestions()"
          class="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-on-fill font-medium transition-colors"
        >
          {{ 'diagnosticQuiz.retry' | t }}
        </button>
      </div>
    }

    <!-- Quiz Content -->
    @if (!loading() && !error() && questions().length > 0) {
      <div
        class="w-full max-w-3xl mx-auto bg-surface-200 rounded-[2rem] border border-primary/20 overflow-hidden"
        role="region"
        aria-label="{{ 'diagnosticQuiz.title' | t }}"
      >
        <!-- Header & Progress -->
        <div class="ps-6 pe-6 pt-6 pb-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-text-primary text-start">
              {{ 'diagnosticQuiz.title' | t }}
            </h2>
            <span class="text-sm text-text-muted bg-primary/10 px-3 py-1 rounded-full text-end">
              {{
                'diagnosticQuiz.questionCounter'
                  | t: { current: currentQuestionNumber(), total: totalQuestions() }
              }}
            </span>
          </div>
          <div
            class="w-full bg-surface-400 rounded-full h-2 overflow-hidden"
            role="progressbar"
            [attr.aria-valuenow]="progressPercentage()"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="h-2 rounded-full transition-all duration-500 ease-out bg-primary"
              [style.width.%]="progressPercentage()"
            ></div>
          </div>
        </div>

        <!-- Question Area -->
        <div class="ps-6 pe-6 pb-6 min-h-[220px]">
          @if (currentQuestion(); as q) {
            <h3
              [id]="'diagnostic-question-' + currentIndex()"
              class="text-lg font-medium text-text-primary mb-6 text-start leading-relaxed"
            >
              {{ q.text }}
            </h3>

            <hlm-radio-group
              [name]="'diagnostic-answer-' + currentIndex()"
              [value]="answers()[q.id]"
              (valueChange)="selectOption(q.id, $event)"
              [attr.aria-labelledby]="'diagnostic-question-' + currentIndex()"
              class="flex flex-col gap-3"
            >
              @for (option of q.options; track option.id; let idx = $index) {
                <hlm-radio
                  [value]="option.points"
                  [aria-label]="
                    'diagnosticQuiz.optionLabel' | t: { number: idx + 1, text: option.text }
                  "
                  class="group w-full cursor-pointer rounded-2xl border-2 border-primary/20 bg-surface-400 ps-5 pe-5 pt-4 pb-4 text-start transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-200 data-[checked=true]:border-primary data-[checked=true]:bg-primary/10 data-[checked=true]:shadow-lg data-[checked=true]:shadow-primary/20"
                >
                  <span
                    class="block text-base font-medium text-text-secondary group-data-[checked=true]:text-text-primary"
                  >
                    <span
                      class="me-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-text-muted group-data-[checked=true]:bg-primary group-data-[checked=true]:text-on-fill"
                      >{{ idx + 1 }}</span
                    >
                    {{ option.text }}
                  </span>
                </hlm-radio>
              }
            </hlm-radio-group>
          }
        </div>

        <!-- Navigation Actions -->
        <div
          class="flex items-center justify-between ps-6 pe-6 pt-4 pb-6 bg-surface-400/60 border-t border-primary/10"
        >
          <button
            hlmBtn
            type="button"
            (click)="previous()"
            [disabled]="isFirstQuestion()"
            class="px-6 py-3 text-sm font-medium text-text-secondary bg-primary/10 rounded-xl hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            {{ 'diagnosticQuiz.previous' | t }}
          </button>

          @if (isLastQuestion()) {
            <button
              hlmBtn
              type="button"
              (click)="next()"
              [disabled]="!canProceed() || isSubmitting()"
              class="px-8 py-3 text-sm font-bold text-on-fill bg-primary rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-200"
              [style.opacity]="!canProceed() || isSubmitting() ? '0.5' : '1'"
            >
              @if (isSubmitting()) {
                <span
                  class="inline-block w-4 h-4 border-2 border-on-fill/30 border-t-on-fill rounded-full animate-spin me-2 align-middle"
                ></span>
              }
              {{ 'diagnosticQuiz.submit' | t }}
            </button>
          } @else {
            <button
              hlmBtn
              type="button"
              (click)="next()"
              [disabled]="!canProceed()"
              class="px-6 py-3 text-sm font-medium text-on-fill bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
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
        <p class="text-text-muted text-sm">{{ 'diagnosticQuiz.empty' | t }}</p>
      </div>
    }
  `,
})
export class DiagnosticQuizComponent {
  private quizService = inject(QuizService);
  private i18n = inject(I18nService);

  targetLanguage = input<string>('en');

  quizCompleted = output<{ score: number; suggestedLevel: string; maxScore: number }>();

  currentIndex = signal<number>(0);
  answers = signal<Record<string, number>>({});
  isSubmitting = signal<boolean>(false);

  private languageOverride = signal<string | undefined>(undefined);

  questionsResource = resource({
    params: () => ({ language: this.activeLanguage() }),
    loader: async ({ params }) => {
      return await this.quizService.getQuestions(params.language);
    },
    defaultValue: [],
  });

  readonly activeLanguage = computed(() => {
    const override = this.languageOverride();
    return override !== undefined ? override : this.targetLanguage();
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

  reloadQuestions(language?: string): void {
    if (language) {
      this.languageOverride.set(language);
    }
    this.currentIndex.set(0);
    this.answers.set({});
    this.questionsResource.reload();
  }

  selectOption(questionId: string, points: unknown): void {
    if (typeof points !== 'number' || !Number.isFinite(points)) return;
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
    const maxScore = totalQuestions * 4;
    const percentage = maxScore > 0 ? totalScore / maxScore : 0;

    let suggestedLevel = 'A1';

    if (percentage >= 0.9) suggestedLevel = 'C2';
    else if (percentage >= 0.8) suggestedLevel = 'C1';
    else if (percentage >= 0.6) suggestedLevel = 'B2';
    else if (percentage >= 0.4) suggestedLevel = 'B1';
    else if (percentage >= 0.2) suggestedLevel = 'A2';

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
