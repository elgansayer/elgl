import { Component, inject, signal, computed, input, viewChild, ElementRef, effect } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';

type ReviewGrade = 'again' | 'good' | 'known';

@Component({
  selector: 'app-flashcard-review',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="mx-auto max-w-md space-y-6 pb-20 pt-4">
      <!-- Header with progress -->
      <section class="app-card app-padded space-y-3" aria-label="{{ 'review.title' | t }}">
        <div class="flex items-center justify-between">
          <h2 class="app-section-title">{{ 'review.title' | t }}</h2>
          <span class="text-xs font-bold text-text-muted" aria-live="polite">
            {{ 'review.progress' | t: { current: currentIndex() + 1, total: reviewCards().length } }}
          </span>
        </div>
        <!-- Progress bar -->
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
        <!-- Session stats -->
        <div class="flex gap-3 text-xs" aria-live="polite" aria-atomic="true">
          <span class="rounded-app bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400">
            {{ 'review.knownCount' | t: { count: sessionStats().known } }}
          </span>
          <span class="rounded-app bg-amber-500/20 px-2 py-0.5 font-bold text-amber-400">
            {{ 'review.goodCount' | t: { count: sessionStats().good } }}
          </span>
          <span class="rounded-app bg-rose-500/20 px-2 py-0.5 font-bold text-rose-400">
            {{ 'review.againCount' | t: { count: sessionStats().again } }}
          </span>
        </div>
      </section>

      @if (isComplete()) {
        <!-- Completion state -->
        <section
          class="rounded-sheet border border-surface-100 bg-surface-200 p-8 text-center space-y-4"
          role="status"
          aria-live="polite"
        >
          <p class="text-4xl" aria-hidden="true">🎉</p>
          <h3 class="text-xl font-black text-text-primary">{{ 'review.completeTitle' | t }}</h3>
          <p class="text-sm text-text-secondary">{{ 'review.completeDesc' | t }}</p>
          <div class="flex flex-wrap justify-center gap-3 text-xs">
            <span class="rounded-app bg-emerald-500/20 px-3 py-1 font-bold text-emerald-400">
              {{ 'review.knownCount' | t: { count: sessionStats().known } }}
            </span>
            <span class="rounded-app bg-amber-500/20 px-3 py-1 font-bold text-amber-400">
              {{ 'review.goodCount' | t: { count: sessionStats().good } }}
            </span>
            <span class="rounded-app bg-rose-500/20 px-3 py-1 font-bold text-rose-400">
              {{ 'review.againCount' | t: { count: sessionStats().again } }}
            </span>
          </div>
          <button
            type="button"
            (click)="restart()"
            class="app-button-primary ps-5 pe-5 pt-2.5 pb-2.5 text-xs font-bold"
          >
            {{ 'review.restart' | t }}
          </button>
        </section>
      } @else {
        <!-- Flashcard -->
        @if (currentCard(); as card) {
          <div class="space-y-4" aria-live="assertive" aria-atomic="true">
            <!-- Card -->
            <div
              #flashcardEl
              class="flip-card cursor-pointer select-none"
              [class.is-flipped]="isFlipped()"
              (click)="flipCard()"
              (keyup.enter)="flipCard()"
              (keyup.space)="flipCard(); $event.preventDefault()"
              role="button"
              tabindex="0"
              [attr.aria-label]="(isFlipped() ? 'review.cardFlippedAriaLabel' : 'review.flipAriaLabel') | t: { word: card.word_token }"
              [attr.aria-pressed]="isFlipped()"
              [attr.aria-describedby]="'card-front-' + card.id + ' card-back-' + card.id"
            >
              <div class="flip-card-inner">
                <!-- Front -->
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
                <!-- Back -->
                <div class="flip-card-face flip-card-back" [attr.id]="'card-back-' + card.id">
                  <div class="mb-3 flex items-center justify-between text-xs font-bold">
                    <span class="rounded-app bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
                      {{ 'review.answerLabel' | t }}
                    </span>
                  </div>
                  <h3 class="text-2xl font-black text-emerald-400">{{ card.translation }}</h3>
                  @if (card.definition) {
                    <p class="mt-3 text-sm text-text-primary">{{ card.definition }}</p>
                  }
                  @if (card.pronunciation_url) {
                    <button
                      type="button"
                      class="mt-3 rounded-app border border-surface-100 px-3 py-1 text-xs font-bold text-text-secondary hover:bg-surface-300"
                      (click)="playAudio(card.pronunciation_url, $event)"
                      [attr.aria-label]="'review.playAudioAriaLabel' | t: { word: card.word_token }"
                    >
                      <span aria-hidden="true">🔊</span>
                      {{ 'review.playAudio' | t }}
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Grading buttons (only visible after flip) -->
            @if (isFlipped()) {
              <div class="grid grid-cols-4 gap-2 animate-fadeIn" role="group" [attr.aria-label]="'review.gradingGroupLabel' | t">
                <button
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
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* 3D Flip Card */
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
        background-color: #1e1e2e;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      }

      .flip-card-back {
        transform: rotateY(180deg);
        background-color: #1a2a1a;
        border-color: rgba(16, 185, 129, 0.2);
      }

      .flip-card-front {
        border-color: rgba(99, 102, 241, 0.2);
      }

      /* Grading buttons */
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
        transition: transform 0.15s, opacity 0.15s;
      }

      .btn-grade:active {
        transform: scale(0.95);
      }

      .btn-grade-again {
        background-color: #f43f5e;
        color: white;
      }

      .btn-grade-again:hover {
        background-color: #e11d48;
      }

      .btn-grade-good {
        background-color: #f59e0b;
        color: #1a1a2e;
      }

      .btn-grade-good:hover {
        background-color: #d97706;
      }

      .btn-grade-known {
        background-color: #10b981;
        color: white;
      }

      .btn-grade-known:hover {
        background-color: #059669;
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

  readonly flashcardEl = viewChild<ElementRef<HTMLElement>>('flashcardEl');

  /** Optional input: a specific set of flashcards to review. If omitted, uses pending review cards from store. */
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
    const intervals: Record<number, string> = {
      1: '3d',
      2: '7d',
      3: '14d',
      4: '30d',
    };
    const days = intervals[nextLevel] ?? '1d';
    return this.i18n.translate('review.goodHint', { interval: days });
  });

private readonly focusEffect = effect(() => {
    if (!this.isFlipped() && !this.isComplete() && this.currentCard()) {
      requestAnimationFrame(() => {
        this.flashcardEl()?.nativeElement?.focus();
      });
    }
  });

  flipCard(): void {
    if (this.currentCard()) {
      this.isFlipped.update((f) => !f);
    }
  }

  async gradeReview(grade: ReviewGrade): Promise<void> {
    if (this.isComplete() || this.isSaving()) return;
    const card = this.currentCard();
    if (!card) return;

    const newLevel = this.computeNewLevel(card.srs_level, grade);

    this.sessionStats.update((s) => ({ ...s, [grade]: s[grade] + 1 }));

    // Persist review to backend
    this.isSaving.set(true);
    try {
      await this.vocabStore.updateSrsLevel(card.id, newLevel);
    } catch {
      // Silently fail - the UI has already optimistically updated
    } finally {
      this.isSaving.set(false);
    }

    this.isFlipped.set(false);

    if (this.currentIndex() < this.reviewCards().length - 1) {
      this.currentIndex.update((i) => i + 1);
    } else {
      this.currentIndex.update((i) => i + 1);
    }
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
      // Audio playback failed silently
    });
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
}