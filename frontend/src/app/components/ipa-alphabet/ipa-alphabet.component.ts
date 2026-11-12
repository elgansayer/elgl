import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import {
  IpaAttemptResult,
  IpaCatalogue,
  IpaLanguageSummary,
  IpaPhoneme,
  IpaPhonemeType,
  IpaQuiz,
  LearningPracticeService,
} from '../../services/learning-practice.service';
import { TranslatePipe } from '../../services/translate.pipe';

type IpaMode = 'chart' | 'practice';

const PHONEME_GROUP_ORDER: readonly IpaPhonemeType[] = [
  'vowel',
  'diphthong',
  'nasal',
  'consonant',
];

interface PhonemeGroup {
  type: IpaPhonemeType;
  phonemes: IpaPhoneme[];
}

@Component({
  selector: 'app-ipa-alphabet',
  imports: [FormsModule, HlmButton, HlmNativeSelect, TranslatePipe],
  template: `
    <section
      class="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6"
      aria-labelledby="ipa-alphabet-title"
    >
      <header class="space-y-1">
        <h1 id="ipa-alphabet-title" class="text-2xl font-bold text-text-primary">
          {{ 'ipaAlphabet.title' | t }}
        </h1>
        <p class="text-sm text-text-muted">{{ 'ipaAlphabet.subtitle' | t }}</p>
      </header>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-text-secondary">
          <span>{{ 'ipaAlphabet.languageLabel' | t }}</span>
          <hlm-native-select
            [ngModel]="selectedLanguage()"
            (ngModelChange)="onLanguageChange($event)"
            name="ipaAlphabetLanguage"
          >
            @for (language of languages(); track language.code) {
              <option [value]="language.code">{{ language.name }}</option>
            }
          </hlm-native-select>
        </label>

        <div
          class="flex flex-wrap gap-2"
          role="group"
          [attr.aria-label]="'ipaAlphabet.mode.label' | t"
        >
          <button
            hlmBtn
            type="button"
            size="touch"
            [variant]="mode() === 'chart' ? 'default' : 'outline'"
            [attr.aria-pressed]="mode() === 'chart'"
            (click)="setMode('chart')"
          >
            {{ 'ipaAlphabet.mode.chart' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            [variant]="mode() === 'practice' ? 'default' : 'outline'"
            [attr.aria-pressed]="mode() === 'practice'"
            (click)="setMode('practice')"
          >
            {{ 'ipaAlphabet.mode.practice' | t }}
          </button>
        </div>
      </div>

      @if (
        languagesResource.isLoading() ||
        catalogueResource.isLoading() ||
        (mode() === 'practice' && quizResource.isLoading())
      ) {
        <p class="text-sm text-text-muted" role="status">
          {{ 'ipaAlphabet.loading' | t }}
        </p>
      } @else if (
        languagesResource.error() ||
        catalogueResource.error() ||
        (mode() === 'practice' && quizResource.error()) ||
        submitError()
      ) {
        <div class="space-y-3 rounded-card border border-surface-100 bg-surface-200 p-4" role="alert">
          <p class="text-sm text-text-muted">{{ 'ipaAlphabet.error' | t }}</p>
          <button hlmBtn type="button" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (mode() === 'chart') {
        @if (catalogueResource.value(); as catalogue) {
          <div class="space-y-6">
            @for (group of phonemeGroups(); track group.type) {
              <section class="space-y-3" [attr.aria-label]="('ipaAlphabet.group.' + group.type) | t">
                <h2 class="text-lg font-semibold text-text-primary">
                  {{ 'ipaAlphabet.group.' + group.type | t }}
                </h2>
                <ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  @for (phoneme of group.phonemes; track phoneme.id) {
                    <li class="rounded-card border border-surface-100 bg-surface-200 p-3">
                      <div class="flex items-baseline justify-between gap-2">
                        <span
                          class="font-mono text-xl font-bold text-text-primary"
                          [attr.lang]="catalogue.languageCode"
                        >
                          {{ phoneme.symbol }}
                        </span>
                        <span class="text-sm text-text-muted">{{ phoneme.example }}</span>
                      </div>
                      <p class="mt-1 text-sm text-text-secondary">{{ phoneme.description }}</p>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        }
      } @else if (currentQuestion(); as question) {
        <article class="space-y-4 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-6">
          <p class="text-sm text-text-muted">
            {{
              'ipaAlphabet.questionCounter'
                | t: { current: currentIndex() + 1, total: quizQuestions().length }
            }}
          </p>

          <div class="space-y-1">
            <h2 class="text-2xl font-bold text-text-primary" [attr.lang]="selectedLanguage()">
              {{ question.symbol }}
            </h2>
            <p class="text-sm text-text-secondary">{{ question.description }}</p>
            <p class="text-sm font-medium text-text-primary">
              {{ 'ipaAlphabet.practicePrompt' | t: { symbol: question.symbol } }}
            </p>
          </div>

          <div
            class="grid gap-2 sm:grid-cols-2"
            role="group"
            [attr.aria-label]="'ipaAlphabet.answerOptions' | t"
          >
            @for (option of question.options; track option) {
              <button
                hlmBtn
                type="button"
                size="touch"
                variant="outline"
                class="justify-start text-start"
                [attr.aria-pressed]="selectedAnswer() === option"
                [class.border-primary]="isCorrectOption(option)"
                [class.bg-primary]="isCorrectOption(option)"
                [class.text-on-fill]="isCorrectOption(option)"
                [class.border-destructive]="isWrongOption(option)"
                [class.bg-destructive]="isWrongOption(option)"
                [class.text-on-fill]="isWrongOption(option)"
                [disabled]="submitting() || feedback() !== null"
                (click)="submitAnswer(option)"
              >
                <span [attr.lang]="selectedLanguage()">{{ option }}</span>
              </button>
            }
          </div>

          @if (feedback(); as result) {
            <div
              class="rounded-app border p-3 text-sm"
              [class.border-primary]="result.correct"
              [class.bg-primary]="result.correct"
              [class.text-on-fill]="result.correct"
              [class.border-destructive]="!result.correct"
              [class.bg-destructive]="!result.correct"
              role="status"
            >
              @if (result.correct) {
                <p>{{ 'ipaAlphabet.correct' | t }}</p>
              } @else {
                <p>{{ 'ipaAlphabet.incorrect' | t: { answer: result.expected } }}</p>
              }
            </div>

            <button hlmBtn type="button" size="touch" (click)="nextQuestion()">
              {{ (isLastQuestion() ? 'ipaAlphabet.finish' : 'ipaAlphabet.next') | t }}
            </button>
          }
        </article>
      } @else {
        <section
          class="space-y-4 rounded-card border border-surface-100 bg-surface-200 p-5 text-center shadow-card"
          role="status"
        >
          <h2 class="text-xl font-bold text-text-primary">
            {{ 'ipaAlphabet.complete.title' | t }}
          </h2>
          <p class="text-text-muted">
            {{
              'ipaAlphabet.complete.message'
                | t: { score: score(), total: quizQuestions().length }
            }}
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <button hlmBtn type="button" size="touch" (click)="newQuiz()">
              {{ 'ipaAlphabet.restart' | t }}
            </button>
            <button hlmBtn type="button" size="touch" variant="outline" (click)="setMode('chart')">
              {{ 'ipaAlphabet.backToChart' | t }}
            </button>
          </div>
        </section>
      }
    </section>
  `,
  styles: [':host { display: block; min-width: 0; }'],
})
export class IpaAlphabetComponent {
  private readonly practiceService = inject(LearningPracticeService);

  readonly selectedLanguage = signal('en');
  readonly mode = signal<IpaMode>('chart');
  readonly currentIndex = linkedSignal(() => {
    this.quizResource.value();
    return 0;
  });
  readonly attempts = linkedSignal(() => {
    this.quizResource.value();
    const empty: IpaAttemptResult[] = [];
    return empty;
  });
  readonly selectedAnswer = signal<string | null>(null);
  readonly feedback = signal<IpaAttemptResult | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly languagesResource = resource<IpaLanguageSummary[], unknown>({
    loader: () => this.practiceService.listIpaLanguages(),
  });

  readonly catalogueResource = resource<IpaCatalogue, string>({
    params: () => this.selectedLanguage(),
    loader: ({ params }) => this.practiceService.getIpaCatalogue(params),
  });

  readonly quizResource = resource<IpaQuiz, string>({
    params: () => this.selectedLanguage(),
    loader: ({ params }) => this.practiceService.getIpaQuiz(params, 5),
  });

  readonly languages = computed(() => this.languagesResource.value() ?? []);
  readonly phonemeGroups = computed<PhonemeGroup[]>(() => {
    const phonemes = this.catalogueResource.value()?.phonemes ?? [];
    return PHONEME_GROUP_ORDER.map((type) => ({
      type,
      phonemes: phonemes.filter((phoneme) => phoneme.type === type),
    })).filter((group) => group.phonemes.length > 0);
  });
  readonly quizQuestions = computed(
    () => this.quizResource.value()?.questions ?? [],
  );
  readonly currentQuestion = computed(
    () => this.quizQuestions()[this.currentIndex()] ?? null,
  );
  readonly isLastQuestion = computed(
    () => this.currentIndex() >= this.quizQuestions().length - 1,
  );
  readonly score = computed(
    () => this.attempts().filter((attempt) => attempt.correct).length,
  );

  onLanguageChange(language: string): void {
    this.selectedLanguage.set(language);
  }

  setMode(mode: IpaMode): void {
    this.mode.set(mode);
  }

  submitAnswer(option: string): void {
    const question = this.currentQuestion();
    if (!question || this.submitting() || this.feedback() !== null) return;

    this.selectedAnswer.set(option);
    this.submitting.set(true);
    this.submitError.set(null);

    this.practiceService
      .checkIpaAnswer(question.id, option)
      .then((result) => {
        this.feedback.set(result);
        this.attempts.update((attempts) => [...attempts, result]);
      })
      .catch(() => {
        this.selectedAnswer.set(null);
        this.submitError.set('ipaAlphabet.error');
      })
      .finally(() => this.submitting.set(false));
  }

  nextQuestion(): void {
    this.currentIndex.update((index) => index + 1);
    this.selectedAnswer.set(null);
    this.feedback.set(null);
    this.submitError.set(null);
  }

  newQuiz(): void {
    this.selectedAnswer.set(null);
    this.feedback.set(null);
    this.submitError.set(null);
    this.quizResource.reload();
  }

  retry(): void {
    this.submitError.set(null);
    this.languagesResource.reload();
    this.catalogueResource.reload();
    this.quizResource.reload();
  }

  isCorrectOption(option: string): boolean {
    const result = this.feedback();
    return result !== null && option === result.expected;
  }

  isWrongOption(option: string): boolean {
    const result = this.feedback();
    return result !== null && !result.correct && option === this.selectedAnswer();
  }
}
