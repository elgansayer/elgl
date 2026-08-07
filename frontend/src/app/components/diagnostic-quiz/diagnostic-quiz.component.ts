import { Component, computed, output, signal, inject, input } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { QuizService, QuizQuestion, QuizResultResponse } from '../../services/quiz.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-diagnostic-quiz',
  imports: [
    KeyValuePipe,
    TranslatePipe,
    AppCardComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  template: `<!-- Loading skeleton -->
@if (isLoading()) {
  <div class="w-full max-w-2xl mx-auto">
    <div class="bg-[#1e1e2a] rounded-2xl p-6 space-y-6 animate-pulse">
      <div class="h-3 bg-surface-200 rounded-full w-1/3"></div>
      <div class="h-2.5 bg-surface-200 rounded-full w-full"></div>
      <div class="space-y-3 mt-6">
        <div class="h-14 bg-surface-200 rounded-xl w-full"></div>
        <div class="h-14 bg-surface-200 rounded-xl w-3/4"></div>
        <div class="h-14 bg-surface-200 rounded-xl w-5/6"></div>
      </div>
    </div>
  </div>
}

<!-- Error state -->
@if (!isLoading() && loadError()) {
  <div class="w-full max-w-2xl mx-auto">
    <div class="bg-[#1e1e2a] rounded-2xl p-8 text-center border border-red-500/20">
      <span class="text-4xl mb-4 block">&#x26A0;&#xFE0F;</span>
      <h3 class="text-lg font-semibold text-white mb-2">{{ 'quiz.loadError.title' | t }}</h3>
      <p class="text-sm text-text-secondary mb-6">{{ 'quiz.loadError.message' | t }}</p>
      <app-button-primary (clicked)="loadQuestions()">
        {{ 'common.retry' | t }}
      </app-button-primary>
    </div>
  </div>
}

<!-- Quiz content -->
@if (!isLoading() && !loadError() && !result() && currentQuestion(); as question) {
  <div class="w-full max-w-2xl mx-auto">
    <app-card customClass="bg-[#1e1e2a] border-surface-100 rounded-2xl">
      <!-- Header &amp; Progress -->
      <div class="mb-8">
        <h2 class="text-xl font-bold text-white mb-2 text-start">
          {{ 'quiz.title' | t }}
        </h2>
        <p class="text-sm text-text-secondary mb-5 text-start">
          {{ 'quiz.subtitle' | t }}
        </p>

        <!-- Progress bar -->
        <div class="relative w-full h-2 bg-surface-200 rounded-full overflow-hidden mb-2">
          <div
            class="absolute start-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
            [style.width.%]="progressPercent()"
            style="background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-text-secondary">
          <span>{{ 'quiz.skill.' + question.skill | t }}</span>
          <span>{{ currentIndex() + 1 }} / {{ questions().length }}</span>
        </div>
      </div>

      <!-- Question Area -->
      <div class="mb-8 min-h-[180px]">
        <h3 class="text-base font-medium text-white mb-6 text-start leading-relaxed">
          {{ question.text }}
        </h3>

        <div class="flex flex-col gap-3">
          @for (option of question.options; track option.id) {
            <button
              type="button"
              (click)="selectOption(question.id, option.points)"
              class="w-full text-start p-4 rounded-xl border transition-all duration-200"
              [class.border-indigo-500]="answers()[question.id] === option.points"
              [class.bg-indigo-500/10]="answers()[question.id] === option.points"
              [class.border-surface-100]="answers()[question.id] !== option.points"
              [class.hover:border-indigo-500/50]="answers()[question.id] !== option.points"
              [class.hover:bg-surface-200]="answers()[question.id] !== option.points"
            >
              <span class="text-sm text-white font-medium">
                {{ option.text }}
              </span>
            </button>
          }
        </div>
      </div>

      <!-- Navigation -->
      <div class="flex items-center justify-between pt-4 border-t border-surface-100">
        <app-button-secondary
          [disabled]="!canGoBack()"
          size="sm"
          (clicked)="goBack()"
        >
          {{ 'quiz.nav.previous' | t }}
        </app-button-secondary>

        <app-button-primary
          [disabled]="!canProceed()"
          size="sm"
          (clicked)="goNext()"
        >
          @if (isLastQuestion()) {
            {{ 'quiz.nav.finish' | t }}
          } @else {
            {{ 'quiz.nav.next' | t }}
          }
        </app-button-primary>
      </div>
    </app-card>
  </div>
}

<!-- Submitting state -->
@if (isSubmitting()) {
  <div class="w-full max-w-2xl mx-auto">
    <div class="bg-[#1e1e2a] rounded-2xl p-12 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/20 mb-6">
        <span class="text-2xl animate-spin">&#x23F3;</span>
      </div>
      <h3 class="text-lg font-semibold text-white mb-2">{{ 'quiz.submitting' | t }}</h3>
      <p class="text-sm text-text-secondary">{{ 'quiz.submittingMessage' | t }}</p>
    </div>
  </div>
}

<!-- Results screen -->
@if (result(); as res) {
  <div class="w-full max-w-2xl mx-auto">
    <app-card customClass="bg-[#1e1e2a] border-surface-100 rounded-2xl">
      <div class="text-center mb-8">
        <!-- CEFR badge -->
        <div class="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4"
          [class]="cefrColour() + ' border-2'">
          <span class="text-3xl font-extrabold">{{ res.suggestedCefr }}</span>
        </div>

        <h2 class="text-2xl font-bold text-white mb-2">{{ 'quiz.result.title' | t }}</h2>
        <p class="text-sm text-text-secondary mb-4">{{ res.description }}</p>

        <!-- Score display -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-200">
          <span class="text-sm text-text-secondary">{{ 'quiz.result.score' | t }}:</span>
          <span class="text-lg font-bold text-indigo-400">{{ res.percentage }}%</span>
          <span class="text-xs text-text-secondary">({{ res.totalScore }}/{{ res.maxScore }})</span>
        </div>
      </div>

      <!-- Skill breakdown -->
      @if (res.skillBreakdown | keyvalue; as skills) {
        <div class="mb-8 space-y-3">
          <h4 class="text-sm font-semibold text-text-secondary text-start mb-3">
            {{ 'quiz.result.skillBreakdown' | t }}
          </h4>
          @for (entry of skills; track entry.key) {
            <div class="flex items-center gap-3">
              <span class="text-xs text-text-secondary w-24 text-end shrink-0">
                {{ skillLabels[entry.key] ? (skillLabels[entry.key] | t) : entry.key }}
              </span>
              <div class="flex-1 h-2 bg-surface-200 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700 ease-out"
                  [style.width.%]="entry.value.max > 0 ? (entry.value.score / entry.value.max * 100) : 0"
                  style="background: linear-gradient(90deg, #6366f1, #a855f7);"
                ></div>
              </div>
              <span class="text-xs text-text-secondary w-12 text-start">
                {{ entry.value.score }}/{{ entry.value.max }}
              </span>
            </div>
          }
        </div>
      }

      <!-- Actions -->
      <div class="flex items-center justify-center gap-4 pt-4 border-t border-surface-100">
        <app-button-secondary size="sm" (clicked)="retake()">
          {{ 'quiz.result.retake' | t }}
        </app-button-secondary>
        <app-button-primary size="sm" (clicked)="quizCompleted.emit({
          score: res.totalScore,
          suggestedCefr: res.suggestedCefr,
          percentage: res.percentage,
          skillBreakdown: res.skillBreakdown
        })">
          {{ 'quiz.result.continue' | t }}
        </app-button-primary>
      </div>
    </app-card>
  </div>
}
`,
})
export class DiagnosticQuizComponent {
  private readonly quizService = inject(QuizService);
  private readonly i18n = inject(I18nService);

  readonly targetLanguage = input('en');
  readonly quizCompleted = output<{
    score: number;
    suggestedCefr: string;
    percentage: number;
    skillBreakdown: Record<string, { score: number; max: number }>;
  }>();

  readonly questions = signal<QuizQuestion[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly answers = signal<Record<string, number>>({});
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<boolean>(false);
  readonly result = signal<QuizResultResponse | null>(null);
  readonly isSubmitting = signal<boolean>(false);

  readonly currentQuestion = computed(() => {
    const qs = this.questions();
    if (qs.length === 0) return null;
    return qs[this.currentIndex()];
  });

  readonly progressPercent = computed(() => {
    const qs = this.questions();
    if (qs.length === 0) return 0;
    return Math.round(((this.currentIndex() + 1) / qs.length) * 100);
  });

  readonly isLastQuestion = computed(() => {
    return this.currentIndex() === this.questions().length - 1;
  });

  readonly canProceed = computed(() => {
    const q = this.currentQuestion();
    if (!q) return false;
    return this.answers()[q.id] !== undefined;
  });

  readonly canGoBack = computed(() => this.currentIndex() > 0);

  readonly skillLabels: Record<string, string> = {
    reading: 'quiz.skill.reading',
    writing: 'quiz.skill.writing',
    speaking: 'quiz.skill.speaking',
    listening: 'quiz.skill.listening',
    grammar: 'quiz.skill.grammar',
    vocabulary: 'quiz.skill.vocabulary',
  };

  readonly cefrColour = computed(() => {
    const level = this.result()?.suggestedCefr;
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

  constructor() {
    this.loadQuestions();
  }

  async loadQuestions(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      const data = await this.quizService.getQuestions(this.targetLanguage());
      this.questions.set(data);
    } catch {
      this.loadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectOption(questionId: string, points: number): void {
    this.answers.update((prev) => ({ ...prev, [questionId]: points }));
  }

  goBack(): void {
    if (this.canGoBack()) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  async goNext(): Promise<void> {
    if (this.isLastQuestion()) {
      await this.submitQuiz();
    } else {
      this.currentIndex.update((i) => i + 1);
    }
  }

  async submitQuiz(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      const res = await this.quizService.evaluateResults(
        this.targetLanguage(),
        this.answers(),
      );
      this.result.set(res);
      this.quizCompleted.emit({
        score: res.totalScore,
        suggestedCefr: res.suggestedCefr,
        percentage: res.percentage,
        skillBreakdown: res.skillBreakdown,
      });
    } catch {
      this.result.set({
        totalScore: 0,
        maxScore: 0,
        percentage: 0,
        suggestedCefr: 'A1',
        skillBreakdown: {},
        description: this.i18n.translate('quiz.result.error'),
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  retake(): void {
    this.answers.set({});
    this.currentIndex.set(0);
    this.result.set(null);
  }
}
