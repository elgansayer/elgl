import { Component, computed, effect, inject, input, output, resource, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import {
  DiagnosticQuizResult,
  QuizService,
} from '../../services/quiz.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { showToast } from '../../services/toast.service';

@Component({
  selector: 'app-diagnostic-quiz',
  imports: [HlmButton, HlmRadioGroup, HlmRadio, TranslatePipe],
  template: `
    @if (loading()) {
      <div
        class="flex flex-col items-center justify-center p-6 sm:p-12"
        role="status"
        aria-label="{{ 'diagnosticQuiz.loading' | t }}"
      >
        <div
          aria-hidden="true"
          class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary"
        ></div>
        <p class="text-sm text-text-secondary">{{ 'diagnosticQuiz.loading' | t }}</p>
      </div>
    }

    @if (error()) {
      <div class="p-6 text-center sm:p-12" role="alert">
        <span aria-hidden="true" class="mb-4 block text-5xl">&#x26A0;&#xFE0F;</span>
        <h3 class="mb-2 text-xl font-semibold text-text-primary">
          {{ 'diagnosticQuiz.errorTitle' | t }}
        </h3>
        <p class="mb-6 text-sm text-text-muted">{{ 'diagnosticQuiz.errorDescription' | t }}</p>
        <button hlmBtn type="button" (click)="reloadQuestions()">
          {{ 'diagnosticQuiz.retry' | t }}
        </button>
      </div>
    }

    @if (!loading() && !error() && questions().length > 0) {
      <section
        class="mx-auto w-full max-w-3xl overflow-hidden rounded-card border border-surface-100 bg-surface-200 shadow-card"
        [attr.aria-labelledby]="quizTitleId"
      >
        <div class="px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div
            class="mb-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <h2 [id]="quizTitleId" class="text-start text-xl font-bold text-text-primary">
              {{ 'diagnosticQuiz.title' | t }}
            </h2>
            <span
              class="self-start rounded-pill bg-primary/10 px-3 py-1 text-sm text-text-muted sm:self-auto"
            >
              {{
                'diagnosticQuiz.questionCounter'
                  | t: { current: currentQuestionNumber(), total: totalQuestions() }
              }}
            </span>
          </div>
          <div
            class="h-2 w-full overflow-hidden rounded-pill bg-surface-300"
            role="progressbar"
            [attr.aria-label]="'diagnosticQuiz.title' | t"
            [attr.aria-valuenow]="progressPercentage()"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              aria-hidden="true"
              class="h-2 rounded-pill bg-primary transition-all duration-500 ease-out"
              [style.width.%]="progressPercentage()"
            ></div>
          </div>
        </div>

        <div class="min-h-[220px] px-4 pb-5 sm:px-6 sm:pb-6">
          @if (currentQuestion(); as question) {
            <h3
              [id]="'diagnostic-question-' + currentIndex()"
              class="mb-6 text-start text-lg font-medium leading-relaxed text-text-primary"
            >
              {{ question.text }}
            </h3>

            <hlm-radio-group
              [name]="'diagnostic-answer-' + currentIndex()"
              [value]="answers()[question.id]"
              (valueChange)="selectOption(question.id, $event)"
              [attr.aria-labelledby]="'diagnostic-question-' + currentIndex()"
              class="flex flex-col gap-3"
            >
              @for (option of question.options; track option.id; let idx = $index) {
                <hlm-radio
                  [value]="option.id"
                  [aria-label]="
                    'diagnosticQuiz.optionLabel' | t: { number: idx + 1, text: option.text }
                  "
                  class="group min-h-11 w-full cursor-pointer rounded-card border-2 border-surface-100 bg-surface-300 px-4 py-4 text-start transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-200 data-[checked=true]:border-primary data-[checked=true]:bg-primary/10 sm:px-5"
                >
                  <span
                    class="flex min-w-0 items-start gap-3 text-base font-medium text-text-secondary group-data-[checked=true]:text-text-primary"
                  >
                    <span
                      aria-hidden="true"
                      class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-text-muted group-data-[checked=true]:bg-primary group-data-[checked=true]:text-on-fill"
                    >{{ idx + 1 }}</span>
                    <span class="min-w-0 flex-1">{{ option.text }}</span>
                  </span>
                </hlm-radio>
              }
            </hlm-radio-group>
          }
        </div>

        <div class="border-t border-surface-100 bg-surface-300 px-4 py-4 sm:px-6 sm:pb-6">
          @if (submitError()) {
            <p class="mb-4 text-sm text-danger" role="alert">
              {{ 'diagnosticQuiz.submitError' | t }}
            </p>
          }

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              hlmBtn
              type="button"
              variant="secondary"
              class="w-full sm:w-auto"
              (click)="previous()"
              [disabled]="isFirstQuestion() || isSubmitting()"
            >
              {{ 'diagnosticQuiz.previous' | t }}
            </button>

            @if (isLastQuestion()) {
              <button
                hlmBtn
                type="button"
                class="w-full sm:w-auto"
                (click)="next()"
                [disabled]="!canProceed() || isSubmitting()"
                [attr.aria-busy]="isSubmitting()"
              >
                @if (isSubmitting()) {
                  <span
                    aria-hidden="true"
                    class="me-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-on-fill/30 border-t-on-fill align-middle"
                  ></span>
                }
                {{ 'diagnosticQuiz.submit' | t }}
              </button>
            } @else {
              <button
                hlmBtn
                type="button"
                class="w-full sm:w-auto"
                (click)="next()"
                [disabled]="!canProceed()"
              >
                {{ 'diagnosticQuiz.next' | t }}
              </button>
            }
          </div>
        </div>
      </section>
    }

    @if (!loading() && !error() && questions().length === 0) {
      <div class="p-6 text-center sm:p-12" role="status">
        <span aria-hidden="true" class="mb-4 block text-5xl">&#x1F4CB;</span>
        <p class="text-sm text-text-muted">{{ 'diagnosticQuiz.empty' | t }}</p>
      </div>
    }
  `,
})
export class DiagnosticQuizComponent {
  private readonly quizService = inject(QuizService);
  private readonly i18n = inject(I18nService);

  readonly targetLanguage = input<string>('en');
  readonly quizCompleted = output<DiagnosticQuizResult>();

  readonly currentIndex = signal(0);
  readonly answers = signal<Record<string, string>>({});
  readonly isSubmitting = signal(false);
  readonly submitError = signal(false);
  readonly quizTitleId = 'diagnostic-quiz-title';

  private readonly languageOverride = signal<string | undefined>(undefined);

  readonly activeLanguage = computed(
    () => this.languageOverride() ?? this.targetLanguage(),
  );

  readonly questionsResource = resource({
    params: () => ({ language: this.activeLanguage() }),
    loader: ({ params }) => this.quizService.getQuestions(params.language),
    defaultValue: [],
  });

  readonly questions = computed(() => this.questionsResource.value());
  readonly loading = computed(() => this.questionsResource.isLoading());
  readonly error = computed(() => this.questionsResource.error());

  readonly currentQuestion = computed(() => {
    const questions = this.questions();
    const index = this.currentIndex();
    return index >= 0 && index < questions.length ? questions[index] : null;
  });

  readonly progressPercentage = computed(() => {
    const total = this.questions().length;
    return total === 0 ? 0 : (this.currentIndex() / total) * 100;
  });

  readonly isLastQuestion = computed(() => {
    const total = this.questions().length;
    return total > 0 && this.currentIndex() === total - 1;
  });
  readonly isFirstQuestion = computed(() => this.currentIndex() === 0);
  readonly canProceed = computed(() => {
    const question = this.currentQuestion();
    return question ? this.answers()[question.id] !== undefined : false;
  });
  readonly currentQuestionNumber = computed(() => this.currentIndex() + 1);
  readonly totalQuestions = computed(() => this.questions().length);

  private readonly resetOnLanguageChange = effect(() => {
    this.activeLanguage();
    this.currentIndex.set(0);
    this.answers.set({});
    this.submitError.set(false);
  });

  reloadQuestions(language?: string): void {
    if (language) this.languageOverride.set(language);
    this.currentIndex.set(0);
    this.answers.set({});
    this.submitError.set(false);
    this.questionsResource.reload();
  }

  selectOption(questionId: string, optionId: unknown): void {
    if (typeof optionId !== 'string') return;
    const question = this.questions().find((item) => item.id === questionId);
    if (!question?.options.some((option) => option.id === optionId)) return;
    this.submitError.set(false);
    this.answers.update((answers) => ({ ...answers, [questionId]: optionId }));
  }

  next(): void {
    if (!this.canProceed() || this.isSubmitting()) return;
    if (this.isLastQuestion()) {
      void this.finishQuiz();
    } else {
      this.currentIndex.update((index) => index + 1);
    }
  }

  previous(): void {
    if (!this.isSubmitting() && this.currentIndex() > 0) {
      this.currentIndex.update((index) => index - 1);
    }
  }

  private async finishQuiz(): Promise<void> {
    this.isSubmitting.set(true);
    this.submitError.set(false);
    try {
      const result = await this.quizService.submitResults({
        targetLanguage: this.activeLanguage(),
        answers: this.answers(),
      });
      this.quizCompleted.emit(result);
    } catch {
      this.submitError.set(true);
      showToast(this.i18n.translate('diagnosticQuiz.submitError'), 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
