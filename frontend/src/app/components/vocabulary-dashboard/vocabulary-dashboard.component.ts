import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, input, signal, viewChild, inject, ErrorHandler } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabCard, VOCABULARY_MOCK_DECK } from './vocab-mock-data';
import { VocabularyStore } from '../../services/vocabulary.store';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';
import { A11yClickableDirective } from '../primitives/a11y-clickable';

type ReviewGrade = 'again' | 'good' | 'known';

@Component({
  selector: 'app-vocabulary-dashboard',
  imports: [HlmButton, TranslatePipe, SrsErrorBoundaryComponent, A11yClickableDirective],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto w-full max-w-md ps-6 pe-6 sm:max-w-lg">
        <h2 class="text-2xl font-bold text-text-primary">{{ 'vocabulary.title' | t }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'vocabulary.subtitle' | t }}</p>

        <div class="mt-8 flex items-center justify-between">
          <span class="text-sm text-text-secondary">{{
            'vocabulary.cardCounter' | t: { current: currentIndex() + 1, total: cardCount() }
          }}</span>
          <button hlmBtn type="button" (click)="restart()" class="btn-secondary text-sm">
            {{ 'vocabulary.restart' | t }}
          </button>
        </div>

        @if (isComplete()) {
          <div class="mt-12 rounded-2xl border border-surface-100 bg-surface-800 p-8 text-center">
            <p class="text-lg font-medium text-text-primary">📚 {{ 'vocabulary.noDue' | t }}</p>
            <button hlmBtn type="button" (click)="restart()" class="mt-4 btn-secondary">
              {{ 'vocabulary.restart' | t }}
            </button>
          </div>
        } @else {
          @if (currentCard(); as card) {
            <div class="mt-4">
              <div
                class="flashcard"
                [class.is-flipped]="isFlipped()"
                (click)="flipCard()"
                appA11yClickable
                tabindex="0"
                [attr.aria-pressed]="isFlipped()"
              >
                <div class="flashcard-inner">
                  <div class="flashcard-face flashcard-front">
                    <span class="block text-lg font-semibold text-text-primary">{{
                      card.term
                    }}</span>
                    <span class="mt-4 block text-sm text-text-muted">{{
                      'vocabulary.tapToFlip' | t
                    }}</span>
                  </div>
                  <div class="flashcard-face flashcard-back">
                    <p class="text-base text-text-primary">{{ card.definition }}</p>
                    @if (card.example; as example) {
                      <p class="mt-3 text-sm italic text-text-muted">“{{ example }}”</p>
                    }
                  </div>
                </div>
              </div>

              <div class="mt-6 flex items-center justify-center gap-3">
                <button
                  hlmBtn
                  type="button"
                  (click)="grade('again')"
                  class="btn-grade btn-grade-again"
                >
                  {{ 'vocabulary.againBtn' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  (click)="grade('good')"
                  class="btn-grade btn-grade-good"
                >
                  {{ 'vocabulary.goodBtn' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  (click)="grade('known')"
                  class="btn-grade btn-grade-known"
                >
                  {{ 'vocabulary.knownBtn' | t }}
                </button>
              </div>
            </div>
          }
        }
      </div>
    </app-srs-error-boundary>
  `,
  styles: [
    `
      :host {
        display: block;
        padding-block: 2rem;
      }

      .flashcard {
        perspective: 1000px;
        cursor: pointer;
      }

      .flashcard-inner {
        position: relative;
        width: 100%;
        height: 14rem;
        transform-style: preserve-3d;
        transition: transform 0.6s;
      }

      .flashcard.is-flipped .flashcard-inner {
        transform: rotateY(180deg);
      }

      .flashcard-face {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        border-radius: 1rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        background-color: rgb(var(--surface-800-rgb));
        border: 1px solid rgb(var(--surface-100-rgb));
      }

      .flashcard-back {
        transform: rotateY(180deg);
        background-color: rgb(var(--surface-700-rgb));
      }

      .btn-grade {
        min-width: 5rem;
        padding-block: 0.5rem;
        padding-inline: 1rem;
        border-radius: 9999px;
        font-weight: 600;
        transition: background-color 0.15s;
      }

      .btn-grade-again {
        background-color: rgb(var(--color-danger-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-grade-good {
        background-color: rgb(var(--color-warning-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-grade-known {
        background-color: rgb(var(--color-success-rgb));
        color: rgb(var(--on-fill-rgb));
      }

      .btn-secondary {
        padding-block: 0.375rem;
        padding-inline: 0.75rem;
        border-radius: 9999px;
        background-color: transparent;
        border: 1px solid rgb(var(--surface-100-rgb));
        color: rgb(var(--text-secondary-rgb));
      }
    `,
  ],
})
export class VocabularyDashboardComponent {
  private errorHandler = inject(ErrorHandler);
  private vocabStore = inject(VocabularyStore);

  readonly deckInput = input<VocabCard[]>([]);

  private readonly mockDeck: readonly VocabCard[] = VOCABULARY_MOCK_DECK;

  readonly deck = computed<readonly VocabCard[]>(() =>
    this.deckInput().length > 0 ? this.deckInput() : this.mockDeck,
  );

  readonly currentIndex = signal(0);
  readonly isFlipped = signal(false);
  readonly grades = signal<Record<ReviewGrade, number>>({ again: 0, good: 0, known: 0 });

  readonly cardCount = computed(() => this.deck().length);
  readonly currentCard = computed(() => this.deck()[this.currentIndex()] ?? null);
  readonly isComplete = computed(
    () => this.cardCount() === 0 || this.currentIndex() >= this.cardCount(),
  );

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'vocabulary-dashboard',
    operation: 'review',
    cardCount: this.cardCount(),
    currentIndex: this.currentIndex(),
    srsLevel: this.currentCard()?.level ?? 0,
  }));

  readonly errorBoundary = viewChild(SrsErrorBoundaryComponent);

  handleRetry(): void {
    this.restart();
  }

  flipCard(): void {
    try {
      if (this.currentCard()) {
        this.isFlipped.update((flipped) => !flipped);
      }
    } catch (err) {
      this.handleComponentError(err, 'flipCard');
    }
  }

  async grade(grade: ReviewGrade): Promise<void> {
    try {
      if (this.isComplete()) return;

      const card = this.currentCard();
      if (card) {
        const qualityMap: Record<ReviewGrade, number> = { again: 0, good: 3, known: 5 };
        await this.vocabStore.updateSrsLevel(card.id, qualityMap[grade]);
      }

      this.grades.update((g) => ({ ...g, [grade]: g[grade] + 1 }));
      this.isFlipped.set(false);
      if (this.currentIndex() < this.cardCount() - 1) {
        this.currentIndex.update((i) => i + 1);
      } else {
        this.currentIndex.set(this.cardCount());
      }
    } catch (err) {
      this.handleComponentError(err, 'grade');
    }
  }

  restart(): void {
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.grades.set({ again: 0, good: 0, known: 0 });
  }

  private handleComponentError(err: unknown, operation: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.errorBoundary()?.captureError(error, undefined, {
      operation,
      cardIndex: this.currentIndex(),
      cardCount: this.cardCount(),
    });
  }
}
