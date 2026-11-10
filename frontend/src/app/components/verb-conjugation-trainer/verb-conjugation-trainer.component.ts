import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import {
  LearningPracticeService,
  VerbAttemptResult,
  VerbLanguageSummary,
  VerbSession,
  VerbTense,
} from '../../services/learning-practice.service';
import { TranslatePipe } from '../../services/translate.pipe';

function isVerbTense(value: string): value is VerbTense {
  return value === 'present' || value === 'past';
}

const FALLBACK_TENSES: VerbTense[] = ['present', 'past'];

@Component({
  selector: 'app-verb-conjugation-trainer',
  imports: [FormsModule, HlmButton, HlmNativeSelect, TranslatePipe],
  template: `
    <section
      class="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6"
      aria-labelledby="verb-conjugation-title"
    >
      <header class="space-y-1">
        <h1 id="verb-conjugation-title" class="text-2xl font-bold text-text-primary">
          {{ 'verbConjugation.title' | t }}
        </h1>
        <p class="text-sm text-text-muted">{{ 'verbConjugation.subtitle' | t }}</p>
      </header>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-text-secondary">
          <span>{{ 'verbConjugation.languageLabel' | t }}</span>
          <hlm-native-select
            [ngModel]="selectedLanguage()"
            (ngModelChange)="onLanguageChange($event)"
            name="verbConjugationLanguage"
          >
            @for (language of verbLanguages(); track language.code) {
              <option [value]="language.code">{{ language.name }}</option>
            }
          </hlm-native-select>
        </label>

        <label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-text-secondary">
          <span>{{ 'verbConjugation.tenseLabel' | t }}</span>
          <hlm-native-select
            [ngModel]="selectedTense()"
            (ngModelChange)="onTenseChange($event)"
            name="verbConjugationTense"
          >
            @for (tense of tenseOptions(); track tense) {
              <option [value]="tense">{{ 'verbConjugation.tense.' + tense | t }}</option>
            }
          </hlm-native-select>
        </label>

        <button hlmBtn type="button" size="touch" (click)="newSession()">
          {{ 'verbConjugation.newSession' | t }}
        </button>
      </div>

      @if (verbLanguagesResource.isLoading() || sessionResource.isLoading()) {
        <p class="text-sm text-text-muted" role="status">
          {{ 'verbConjugation.loading' | t }}
        </p>
      } @else if (verbLanguagesResource.error() || sessionResource.error() || submitError()) {
        <div class="space-y-3 rounded-card border border-surface-100 bg-surface-200 p-4" role="alert">
          <p class="text-sm text-text-muted">{{ 'verbConjugation.error' | t }}</p>
          <button hlmBtn type="button" size="touch" (click)="retry()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else if (sessionResource.value(); as session) {
        @if (currentExercise(); as exercise) {
          <article class="space-y-4 rounded-card border border-surface-100 bg-surface-200 p-4 shadow-card sm:p-6">
            <p class="text-sm text-text-muted">
              {{
                'verbConjugation.questionCounter'
                  | t: { current: currentIndex() + 1, total: session.exercises.length }
              }}
            </p>

            <div class="space-y-1">
              <h2 class="text-lg font-medium leading-relaxed text-text-primary">
                {{
                  'verbConjugation.prompt'
                    | t
                      : {
                          verb: exercise.infinitive,
                          person: ('verbConjugation.person.' + exercise.person | t),
                          tense: ('verbConjugation.tense.' + exercise.tense | t),
                        }
                }}
              </h2>
              <p class="text-sm text-text-muted">
                {{ 'verbConjugation.translation' | t: { translation: exercise.translation } }}
              </p>
              <p class="text-base font-semibold" [attr.lang]="exercise.languageCode">
                {{ exercise.infinitive }}
              </p>
            </div>

            <div
              class="grid gap-2 sm:grid-cols-2"
              role="group"
              [attr.aria-label]="'verbConjugation.answerOptions' | t"
            >
              @for (option of exercise.options; track option) {
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
                  <span [attr.lang]="exercise.languageCode">{{ option }}</span>
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
                  <p>{{ 'verbConjugation.correct' | t }}</p>
                } @else {
                  <p>
                    {{
                      'verbConjugation.incorrect'
                        | t: { answer: result.expected }
                    }}
                  </p>
                }
              </div>

              <button hlmBtn type="button" size="touch" (click)="nextQuestion()">
                {{ (isLastQuestion() ? 'verbConjugation.finish' : 'verbConjugation.next') | t }}
              </button>
            }
          </article>
        } @else {
          <section
            class="space-y-4 rounded-card border border-surface-100 bg-surface-200 p-5 text-center shadow-card"
            role="status"
          >
            <h2 class="text-xl font-bold text-text-primary">
              {{ 'verbConjugation.complete.title' | t }}
            </h2>
            <p class="text-text-muted">
              {{
                'verbConjugation.complete.message'
                  | t: { score: score(), total: session.exercises.length }
              }}
            </p>
            <button hlmBtn type="button" size="touch" (click)="newSession()">
              {{ 'verbConjugation.restart' | t }}
            </button>
          </section>
        }
      }
    </section>
  `,
  styles: [':host { display: block; min-width: 0; }'],
})
export class VerbConjugationTrainerComponent {
  private readonly practiceService = inject(LearningPracticeService);

  readonly selectedLanguage = signal('es');
  readonly selectedTense = signal<VerbTense>('present');
  readonly currentIndex = linkedSignal(() => {
    this.sessionResource.value();
    return 0;
  });
  readonly attempts = linkedSignal(() => {
    this.sessionResource.value();
    const empty: VerbAttemptResult[] = [];
    return empty;
  });
  readonly selectedAnswer = signal<string | null>(null);
  readonly feedback = signal<VerbAttemptResult | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly verbLanguagesResource = resource<VerbLanguageSummary[], unknown>({
    loader: () => this.practiceService.listVerbLanguages(),
  });

  readonly sessionResource = resource<
    VerbSession,
    { language: string; tense: VerbTense }
  >({
    params: () => ({
      language: this.selectedLanguage(),
      tense: this.selectedTense(),
    }),
    loader: ({ params }) =>
      this.practiceService.getVerbSession(params.language, params.tense, 5),
  });

  readonly verbLanguages = computed(
    () => this.verbLanguagesResource.value() ?? [],
  );
  readonly tenseOptions = computed(() => {
    const language = this.verbLanguages().find(
      (entry) => entry.code === this.selectedLanguage(),
    );
    return language?.tenses ?? FALLBACK_TENSES;
  });
  readonly currentExercise = computed(() => {
    const session = this.sessionResource.value();
    return session?.exercises[this.currentIndex()] ?? null;
  });
  readonly isLastQuestion = computed(() => {
    const session = this.sessionResource.value();
    return session ? this.currentIndex() >= session.exercises.length - 1 : false;
  });
  readonly score = computed(
    () => this.attempts().filter((attempt) => attempt.correct).length,
  );

  onLanguageChange(language: string): void {
    this.selectedLanguage.set(language);
    const available = this.verbLanguages().find(
      (entry) => entry.code === language,
    );
    if (available && !available.tenses.includes(this.selectedTense())) {
      this.selectedTense.set(available.tenses[0]);
    }
  }

  onTenseChange(tense: string): void {
    if (isVerbTense(tense)) this.selectedTense.set(tense);
  }

  submitAnswer(option: string): void {
    const exercise = this.currentExercise();
    if (!exercise || this.submitting() || this.feedback() !== null) return;

    this.selectedAnswer.set(option);
    this.submitting.set(true);
    this.submitError.set(null);

    this.practiceService
      .checkVerbAnswer(exercise.id, option)
      .then((result) => {
        this.feedback.set(result);
        this.attempts.update((attempts) => [...attempts, result]);
      })
      .catch(() => {
        this.selectedAnswer.set(null);
        this.submitError.set('verbConjugation.error');
      })
      .finally(() => this.submitting.set(false));
  }

  nextQuestion(): void {
    this.currentIndex.update((index) => index + 1);
    this.selectedAnswer.set(null);
    this.feedback.set(null);
    this.submitError.set(null);
  }

  newSession(): void {
    this.selectedAnswer.set(null);
    this.feedback.set(null);
    this.submitError.set(null);
    this.sessionResource.reload();
  }

  retry(): void {
    this.submitError.set(null);
    this.verbLanguagesResource.reload();
    this.sessionResource.reload();
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
