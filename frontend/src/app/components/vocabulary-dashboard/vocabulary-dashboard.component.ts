import { Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabCard, VOCABULARY_MOCK_DECK } from './vocab-mock-data';

type ReviewGrade = 'again' | 'good' | 'known';

@Component({
  selector: 'app-vocabulary-dashboard',
  imports: [TranslatePipe],
  template: `
    <div class="mx-auto w-full max-w-md ps-6 pe-6 sm:max-w-lg">
      <h2 class="text-2xl font-bold text-slate-100">{{ 'vocabulary.title' | t }}</h2>
      <p class="mt-1 text-sm text-slate-400">{{ 'vocabulary.subtitle' | t }}</p>

      <div class="mt-8 flex items-center justify-between">
        <span class="text-sm text-slate-300">{{
          'vocabulary.cardCounter' | t: { current: currentIndex() + 1, total: cardCount() }
        }}</span>
        <button type="button" (click)="restart()" class="btn-secondary text-sm">{{
          'vocabulary.restart' | t
        }}</button>
      </div>

      @if (isComplete()) {
        <div class="mt-12 rounded-2xl border border-slate-700 bg-surface-800 p-8 text-center">
          <p class="text-lg font-medium text-slate-100">📚 {{ 'vocabulary.noDue' | t }}</p>
          <button type="button" (click)="restart()" class="mt-4 btn-secondary">{{
            'vocabulary.restart' | t
          }}</button>
        </div>
      } @else {
        @if (currentCard(); as card) {
          <div class="mt-4">
            <div
              class="flashcard"
              [class.is-flipped]="isFlipped()"
              (click)="flipCard()"
              role="button"
              [attr.aria-pressed]="isFlipped()"
            >
              <div class="flashcard-inner">
                <div class="flashcard-face flashcard-front">
                  <span class="block text-lg font-semibold text-slate-100">{{ card.term }}</span>
                  <span class="mt-4 block text-sm text-slate-400">{{ 'vocabulary.tapToFlip' | t }}</span>
                </div>
                <div class="flashcard-face flashcard-back">
                  <p class="text-base text-slate-100">{{ card.definition }}</p>
                  @if (card.example; as example) {
                    <p class="mt-3 text-sm italic text-slate-400">“{{ example }}”</p>
                  }
                </div>
              </div>
            </div>

            <div class="mt-6 flex items-center justify-center gap-3">
              <button type="button" (click)="grade('again')" class="btn-grade btn-grade-again">{{
                'vocabulary.againBtn' | t
              }}</button>
              <button type="button" (click)="grade('good')" class="btn-grade btn-grade-good">{{
                'vocabulary.goodBtn' | t
              }}</button>
              <button type="button" (click)="grade('known')" class="btn-grade btn-grade-known">{{
                'vocabulary.knownBtn' | t
              }}</button>
            </div>
          </div>
        }
      }
    </div>
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
        background-color: #1e1e2e;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .flashcard-back {
        transform: rotateY(180deg);
        background-color: #2a2a3a;
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
        background-color: #f43f5e;
        color: white;
      }

      .btn-grade-good {
        background-color: #f59e0b;
        color: black;
      }

      .btn-grade-known {
        background-color: #10b981;
        color: white;
      }

      .btn-secondary {
        padding-block: 0.375rem;
        padding-inline: 0.75rem;
        border-radius: 9999px;
        background-color: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #cbd5e1;
      }
    `,
  ],
})
export class VocabularyDashboardComponent {
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

  flipCard(): void {
    if (this.currentCard()) {
      this.isFlipped.update((flipped) => !flipped);
    }
  }

  grade(grade: ReviewGrade): void {
    if (this.isComplete()) return;
    this.grades.update((g) => ({ ...g, [grade]: g[grade] + 1 }));
    this.isFlipped.set(false);
    if (this.currentIndex() < this.cardCount() - 1) {
      this.currentIndex.update((i) => i + 1);
    } else {
      this.currentIndex.set(this.cardCount());
    }
  }

  restart(): void {
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.grades.set({ again: 0, good: 0, known: 0 });
  }
}
