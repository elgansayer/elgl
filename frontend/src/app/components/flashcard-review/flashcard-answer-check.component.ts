import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { Flashcard } from '../../services/vocabulary.store';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  FlashcardAnswerAssessment,
  FlashcardAnswerGrade,
  scoreFlashcardAnswer,
} from './flashcard-answer-scoring';

const MAX_ANSWER_LENGTH = 256;

@Component({
  selector: 'app-flashcard-answer-check',
  standalone: true,
  imports: [HlmButton, HlmInput, TranslatePipe],
  template: `
    @if (!revealed()) {
      <form
        class="rounded-sheet border border-surface-100 bg-surface-200 p-4"
        (submit)="checkAnswer($event)"
        novalidate
      >
        <label class="mb-2 block text-sm font-bold text-text-primary" [for]="inputId()">
          {{ 'review.answerLabel' | t }}
        </label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            hlmInput
            [id]="inputId()"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="done"
            [maxlength]="maxAnswerLength"
            [value]="answer()"
            (input)="updateAnswer($event)"
            [placeholder]="'review.answerLabel' | t"
            class="min-h-11 min-w-0 flex-1"
            dir="auto"
          />
          <button
            hlmBtn
            type="submit"
            class="min-h-11 shrink-0"
            [disabled]="answer().trim().length === 0"
          >
            {{ 'common.ok' | t }}
          </button>
        </div>
        <p class="mt-2 text-xs text-text-muted">{{ 'review.tapToFlip' | t }}</p>
      </form>
    } @else if (assessment(); as result) {
      <section
        class="rounded-sheet border border-surface-100 bg-surface-200 p-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        @switch (result.match) {
          @case ('exact') {
            <p class="font-bold text-success">✓ {{ 'review.knownAriaLabel' | t }}</p>
          }
          @case ('partial') {
            <p class="font-bold text-warning">
              ≈ {{ result.score }}% · {{ 'review.goodAriaLabel' | t }}
            </p>
          }
          @case ('incorrect') {
            <p class="font-bold text-danger">
              {{ result.score }}% · {{ 'review.againAriaLabel' | t }}
            </p>
          }
          @default {
            <p class="font-bold text-text-primary">{{ 'common.error_generic' | t }}</p>
          }
        }

        @if (result.suggestedGrade; as grade) {
          <button hlmBtn type="button" class="mt-3 min-h-11" (click)="applySuggestedGrade(grade)">
            @switch (grade) {
              @case ('known') {
                {{ 'review.knownBtn' | t }}
              }
              @case ('good') {
                {{ 'review.goodBtn' | t }}
              }
              @case ('again') {
                {{ 'review.againBtn' | t }}
              }
            }
          </button>
        }
      </section>
    }
  `,
})
export class FlashcardAnswerCheckComponent {
  readonly card = input.required<Flashcard>();
  readonly revealed = input(false);
  readonly reveal = output<void>();
  readonly applyGrade = output<FlashcardAnswerGrade>();

  readonly maxAnswerLength = MAX_ANSWER_LENGTH;
  readonly answer = signal('');
  readonly assessment = signal<FlashcardAnswerAssessment | null>(null);
  readonly inputId = computed(() => `flashcard-answer-${this.card().id}`);

  private previousCardId = '';

  constructor() {
    effect(() => {
      const cardId = this.card().id;
      if (cardId !== this.previousCardId) {
        this.previousCardId = cardId;
        this.answer.set('');
        this.assessment.set(null);
      }
    });
  }

  updateAnswer(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.answer.set(target.value.slice(0, MAX_ANSWER_LENGTH));
  }

  checkAnswer(event: Event): void {
    event.preventDefault();
    const submitted = this.answer().trim();
    if (!submitted) return;

    this.assessment.set(scoreFlashcardAnswer(this.card().translation ?? '', submitted));
    this.reveal.emit();
  }

  applySuggestedGrade(grade: FlashcardAnswerGrade): void {
    this.applyGrade.emit(grade);
  }
}
