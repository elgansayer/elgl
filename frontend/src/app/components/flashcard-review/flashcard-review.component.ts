import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  signal,
  computed,
  input,
  viewChild,
  ElementRef,
  effect,
  ErrorHandler,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { A11yClickableDirective } from '../primitives/a11y-clickable';
import { FlashcardAnswerCheckComponent } from './flashcard-answer-check.component';

type ReviewGrade = 'again' | 'good' | 'known';

@Component({
  selector: 'app-flashcard-review',
  standalone: true,
  imports: [
    HlmButton,
    TranslatePipe,
    SrsErrorBoundaryComponent,
    AppSkeletonLoaderComponent,
    AppEmptyStateComponent,
    AppCardComponent,
    AppButtonPrimaryComponent,
    A11yClickableDirective,
    FlashcardAnswerCheckComponent,
  ],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto max-w-md space-y-6 pb-20 pt-4">
        @if (isDegraded()) {
          <div
            class="rounded-sheet border border-warning/30 bg-warning/10 p-3 text-center"
            role="status"
            aria-live="polite"
          >
            <p class="text-xs font-bold text-warning">{{ 'review.degradedBanner' | t }}</p>
            @if (degradedReason()) {
              <p class="mt-1 text-[11px] text-text-muted">{{ degradedReason() }}</p>
            }
          </div>
        }
        @if (isLoading()) {
          <app-card customClass="app-padded space-y-3" aria-label="{{ 'review.title' | t }}">
            <div class="flex items-center justify-between">
              <app-skeleton-loader [height]="'20px'" [width]="'140px'" [borderRadius]="'8px'" />
              <app-skeleton-loader [height]="'14px'" [width]="'60px'" [borderRadius]="'8px'" />
            </div>
            <app-skeleton-loader [height]="'6px'" [width]="'100%'" [borderRadius]="'4px'" />
            <div class="flex gap-3">
              <app-skeleton-loader [height]="'20px'" [width]="'52px'" [borderRadius]="'999px'" />
              <app-skeleton-loader [height]="'20px'" [width]="'52px'" [borderRadius]="'999px'" />
              <app-skeleton-loader [height]="'20px'" [width]="'52px'" [borderRadius]="'999px'" />
            </div>
          </app-card>
          <app-card customClass="app-padded space-y-4" aria-hidden="true">
            <app-skeleton-loader [height]="'14rem'" [width]="'100%'" [borderRadius]="'1rem'" />
            <div class="grid grid-cols-4 gap-2">
              <app-skeleton-loader
                [height]="'4.5rem'"
                [width]="'100%'"
                [borderRadius]="'0.75rem'"
              />
              <app-skeleton-loader
                [height]="'4.5rem'"
                [width]="'100%'"
                [borderRadius]="'0.75rem'"
                class="col-span-2"
              />
              <app-skeleton-loader
                [height]="'4.5rem'"
                [width]="'100%'"
                [borderRadius]="'0.75rem'"
              />
            </div>
          </app-card>
        } @else if (reviewCards().length === 0) {
          <app-empty-state
            [icon]="'🎯'"
            [title]="'review.emptyTitle' | t"
            [description]="'review.emptyDesc' | t"
          />
        } @else {
          <app-card customClass="app-padded space-y-3" aria-label="{{ 'review.title' | t }}">
            <div class="flex items-center justify-between">
              <h2 class="app-section-title">{{ 'review.title' | t }}</h2>
              <span class="text-xs font-bold text-text-muted" aria-live="polite">
                {{
                  'review.progress'
                    | t: { current: currentIndex() + 1, total: reviewCards().length }
                }}
              </span>
            </div>
            <div
              class="h-1.5 w-full overflow-hidden rounded-full bg-surface-200"
              role="progressbar"
              [attr.aria-valuenow]="progressPercent()"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-label]="'review.progressPercent' | t: { percent: progressPercent() }"
            >
              <div
                class="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                [style.width]="progressPercent() + '%'"
              ></div>
            </div>
            <div class="flex gap-3 text-xs" aria-live="polite" aria-atomic="true">
              <span class="rounded-app bg-success/20 px-2 py-0.5 font-bold text-success">
                {{ 'review.knownCount' | t: { count: sessionStats().known } }}
              </span>
              <span class="rounded-app bg-warning/20 px-2 py-0.5 font-bold text-warning">
                {{ 'review.goodCount' | t: { count: sessionStats().good } }}
              </span>
              <span class="rounded-app bg-danger/20 px-2 py-0.5 font-bold text-danger">
                {{ 'review.againCount' | t: { count: sessionStats().again } }}
              </span>
            </div>
          </app-card>

          @if (isComplete()) {
            <section
              class="rounded-sheet border border-surface-100 bg-surface-200 p-8 text-center space-y-4"
              role="status"
              aria-live="polite"
            >
              <p class="text-4xl" aria-hidden="true">🎉</p>
              <h3 class="text-xl font-black text-text-primary">{{ 'review.completeTitle' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'review.completeDesc' | t }}</p>
              <div class="flex flex-wrap justify-center gap-3 text-xs">
                <span class="rounded-app bg-success/20 px-3 py-1 font-bold text-success">
                  {{ 'review.knownCount' | t: { count: sessionStats().known } }}
                </span>
                <span class="rounded-app bg-warning/20 px-3 py-1 font-bold text-warning">
                  {{ 'review.goodCount' | t: { count: sessionStats().good } }}
                </span>
                <span class="rounded-app bg-danger/20 px-3 py-1 font-bold text-danger">
                  {{ 'review.againCount' | t: { count: sessionStats().again } }}
                </span>
              </div>
              <app-button-primary (clicked)="restart()" customClass="ps-5 pe-5 text-xs font-bold">
                {{ 'review.restart' | t }}
              </app-button-primary>
            </section>
          } @else {
            @if (currentCard(); as card) {
              <div class="space-y-4" aria-live="assertive" aria-atomic="true">
                <div
                  #flashcardEl
                  class="flip-card cursor-pointer select-none"
                  [class.is-flipped]="isFlipped()"
                  (click)="flipCard()"
                  appA11yClickable
                  tabindex="0"
                  [attr.aria-label]="
                    (isFlipped() ? 'review.cardFlippedAriaLabel' : 'review.flipAriaLabel')
                      | t: { word: card.word_token }
                  "
                  [attr.aria-pressed]="isFlipped()"
                  [attr.aria-describedby]="'card-front-' + card.id + ' card-back-' + card.id"
                >
                  <div class="flip-card-inner">
                    <div class="flip-card-face flip-card-front" [attr.id]="'card-front-' + card.id">
                      <div class="mb-3 flex items-center justify-between text-xs font-bold">
                        <span class="rounded-app bg-primary/20 px-2 py-0.5 text-primary">
                          {{ 'review.levelBadge' | t: { level: card.srs_level } }}
                        </span>
                        @if (card.original_context) {
                          <span class="text-text-muted truncate max-w-[60%]">
                            {{ 'review.contextLabel' | t }}
                          </span>
                        }
                      </div>
                      <h3 class="text-3xl font-black text-text-primary">{{ card.word_token }}</h3>
                      @if (card.original_context) {
                        <p class="mt-3 text-sm italic text-text-secondary">
                          &ldquo;{{ card.original_context }}&rdquo;
                        </p>
                      }
                      <p class="mt-4 text-xs font-bold text-primary">
                        {{ 'review.tapToFlip' | t }}
                      </p>
                    </div>
                    <div class="flip-card-face flip-card-back" [attr.id]="'card-back-' + card.id">
                      <div class="mb-3 flex items-center justify-between text-xs font-bold">
                        <span class="rounded-app bg-success/20 px-2 py-0.5 text-success">
                          {{ 'review.answerLabel' | t }}
                        </span>
                      </div>
                      <h3 class="text-2xl font-black text-success">{{ card.translation }}</h3>
                      @if (card.definition) {
                        <p class="mt-3 text-sm text-text-primary">{{ card.definition }}</p>
                      }
                      @if (card.pronunciation_url) {
                        <button
                          hlmBtn
                          type="button"
                          class="mt-3 rounded-app border border-surface-100 px-3 py-1 text-xs font-bold text-text-secondary hover:bg-surface-300"
                          (click)="playAudio(card.pronunciation_url, $event)"
                          [attr.aria-label]="
                            'review.playAudioAriaLabel' | t: { word: card.word_token }
                          "
                        >
                          <span aria-hidden="true">🔊</span>
                          {{ 'review.playAudio' | t }}
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <app-flashcard-answer-check
                  [card]="card"
                  [revealed]="isFlipped()"
                  (reveal)="showAnswer()"
                  (applyGrade)="gradeReview($event)"
                />

                @if (isFlipped()) {
                  <div
                    class="grid grid-cols-4 gap-2 animate-fadeIn"
                    role="group"
                    [attr.aria-label]="'review.gradingGroupLabel' | t"
                  >
                    <button
                      hlmBtn
                      type="button"
                      (click)="gradeReview('again')"
                      class="btn-grade btn-grade-again"
                      [attr.aria-label]="'review.againAriaLabel' | t"
                    >
                      <span class="block text-lg" aria-hidden="true">↻</span>
                      <span class="text-xs font-bold">{{ 'review.againBtn' | t }}</span>
                      <span class="text-[10px] opacity-80">{{ 'review.againHint' | t }}</span>
                    </button>
                    <button
                      hlmBtn
                      type="button"
                      (click)="gradeReview('good')"
                      class="btn-grade btn-grade-good col-span-2"
                      [attr.aria-label]="'review.goodAriaLabel' | t"
                    >
                      <span class="block text-lg" aria-hidden="true">✓</span>
                      <span class="text-xs font-bold">{{ 'review.goodBtn' | t }}</span>
                      <span class="text-[10px] opacity-80">{{ nextIntervalHint() }}</span>
                    </button>
                    <button
                      hlmBtn
                      type="button"
                      (click)="gradeReview('known')"
                      class="btn-grade btn-grade-known"
                      [attr.aria-label]="'review.knownAriaLabel' | t"
                    >
                      <span class="block text-lg" aria-hidden="true">★</span>
                      <span class="text-xs font-bold">{{ 'review.knownBtn' | t }}</span>
                      <span class="text-[10px] opacity-80">{{ 'review.knownHint' | t }}</span>
                    </button>
                  </div>
                }
              </div>
            }
          }
        }
      </div>
    </app-srs-error-boundary>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .flip-card {
        perspective: 1200px;
      }

      .flip-card-inner {
        position: relative;
        width: 100%;
        min-height: 14rem;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .flip-card.is-flipped .flip-card-inner {
        transform: rotateY(180deg);
      }

      .flip-card-face {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        border-radius: 1rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background-color: rgb(var(--surface-800-rgb));
        border: 1px solid rgb(var(--surface-100-rgb));
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      }

      .flip-card-back {
        transform: rotateY(180deg);
        background-color: rgb(var(--surface-700-rgb));
        border-color: rgb(var(--color-success-rgb) / 0.2);
      }

      .flip-card-front {
        border-color: rgb(var(--color-primary-rgb) / 0.2);
      }

      .btn-grade {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.125rem;
        padding-block: 0.75rem;
        padding-inline: 0.75rem;
        border-radius: 0.75rem;
        border: none;
        cursor: pointer;
        transition:
          transform 0.15s,
          opacity 0.15s;
      }

      .btn-grade:active {
        transform: scale(0.95);
      }

      .btn-grade-again {
        background-color: rgb(var(--color-danger-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-grade-again:hover {
        background-color: rgb(var(--color-danger-rgb) / 0.85);
      }

      .btn-grade-good {
        background-color: rgb(var(--color-warning-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-grade-good:hover {
        background-color: rgb(var(--color-warning-rgb) / 0.85);
      }

      .btn-grade-known {
        background-color: rgb(var(--color-success-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-grade-known:hover {
        background-color: rgb(var(--color-success-rgb) / 0.85);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }
    `,
  ],
})
export class FlashcardReviewComponent {
  private vocabStore = inject(VocabularyStore);
  private i18n = inject(I18nService);
  private errorHandler = inject(ErrorHandler);
  private haptic = inject(HapticFeedbackService);

  readonly flashcardEl = viewChild<ElementRef<HTMLElement>>('flashcardEl');
  readonly cards = input<Flashcard[]>([]);

  readonly reviewCards = computed<Flashcard[]>(() => {
    const provided = this.cards();
    if (provided.length > 0) return provided;
    return this.vocabStore.pendingReviewCards();
  });

  readonly currentIndex = signal(0);
  readonly isFlipped = signal(false);
  readonly sessionStats = signal<Record<ReviewGrade, number>>({ again: 0, good: 0, known: 0 });
  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly loadError = signal(false);
  readonly isDegraded = signal(false);
  readonly degradedReason = signal('');

  readonly currentCard = computed(() => this.reviewCards()[this.currentIndex()] ?? null);
  readonly isComplete = computed(
    () => this.reviewCards().length === 0 || this.currentIndex() >= this.reviewCards().length,
  );
  readonly progressPercent = computed(() => {
    if (this.reviewCards().length === 0) return 100;
    return Math.round((this.currentIndex() / this.reviewCards().length) * 100);
  });

  readonly nextIntervalHint = computed(() => {
    const card = this.currentCard();
    if (!card) return '';
    const nextLevel = card.srs_level < 4 ? card.srs_level + 1 : 4;
    const intervals: Record<number, string> = { 1: '3d', 2: '7d', 3: '14d', 4: '30d' };
    const days = intervals[nextLevel] ?? '1d';
    return this.i18n.translate('review.goodHint', { interval: days });
  });

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'flashcard-review',
    operation: 'review',
    cardCount: this.reviewCards().length,
    currentIndex: this.currentIndex(),
    srsLevel: this.currentCard()?.srs_level,
  }));

  handleRetry(): void {
    this.restart();
    this.loadReviewData();
  }

  constructor() {
    this.loadReviewData();
    effect(() => {
      if (!this.isFlipped() && !this.isComplete() && this.currentCard()) {
        const elRef = this.flashcardEl();
        if (elRef) {
          requestAnimationFrame(() => elRef.nativeElement.focus());
        }
      }
    });
  }

  private async loadReviewData(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      await this.vocabStore.loadAllFlashcards();
      await this.vocabStore.loadDueReviews();
    } catch {
      this.loadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
    this.isDegraded.set(this.vocabStore.isDegraded());
    this.degradedReason.set(this.vocabStore.degradedReason());
  }

  flipCard(): void {
    if (this.currentCard()) {
      this.isFlipped.update((flipped) => !flipped);
    }
  }

  showAnswer(): void {
    if (this.currentCard()) this.isFlipped.set(true);
  }

  async gradeReview(grade: ReviewGrade): Promise<void> {
    if (this.isComplete() || this.isSaving()) return;
    const card = this.currentCard();
    if (!card) return;

    const newLevel = this.computeNewLevel(card.srs_level, grade);
    this.triggerHaptic(grade);
    this.sessionStats.update((stats) => ({ ...stats, [grade]: stats[grade] + 1 }));

    this.isSaving.set(true);
    try {
      await this.vocabStore.updateSrsLevel(card.id, newLevel);
    } catch {
      // Existing degraded/offline store behavior owns retry and recovery.
    } finally {
      this.isSaving.set(false);
    }

    this.isFlipped.set(false);
    this.currentIndex.update((index) => index + 1);
  }

  restart(): void {
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.sessionStats.set({ again: 0, good: 0, known: 0 });
  }

  playAudio(url: string, event: MouseEvent): void {
    event.stopPropagation();
    const audio = new Audio(url);
    audio.play().catch(() => {
      // Audio playback remains best effort.
    });
    audio.addEventListener(
      'ended',
      () => {
        audio.src = '';
        audio.load();
      },
      { once: true },
    );
  }

  private computeNewLevel(currentLevel: number, grade: ReviewGrade): number {
    switch (grade) {
      case 'again':
        return 0;
      case 'good':
        return currentLevel < 3 ? currentLevel + 1 : 3;
      case 'known':
        return 4;
    }
  }

  private triggerHaptic(grade: ReviewGrade): void {
    switch (grade) {
      case 'known':
        this.haptic.trigger('selection');
        break;
      case 'good':
        this.haptic.trigger('medium');
        break;
      case 'again':
        this.haptic.trigger('light');
        break;
    }
  }
}
