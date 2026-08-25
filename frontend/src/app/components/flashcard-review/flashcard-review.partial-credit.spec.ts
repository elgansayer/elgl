import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { I18nService } from '../../services/i18n.service';
import { Flashcard, VocabularyStore } from '../../services/vocabulary.store';
import { FlashcardReviewComponent } from './flashcard-review.component';

const CARD = {
  id: 'card-1',
  user_id: 'user-1',
  word_token: '豊富な',
  translation: 'abundant',
  definition: 'existing in large quantities',
  srs_level: 1,
  easiness_factor: 2.5,
  repetitions: 0,
  interval_days: 0,
  next_review_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as Flashcard;

const SECOND_CARD = { ...CARD, id: 'card-2', word_token: '親切な', translation: 'kind' };

function findAnswerInput(root: HTMLElement): HTMLInputElement {
  const input = root.querySelector('app-flashcard-answer-check input');
  if (!(input instanceof HTMLInputElement)) throw new Error('answer input missing');
  return input;
}

async function submitTypedAnswer(
  fixture: ReturnType<typeof TestBed.createComponent<FlashcardReviewComponent>>,
  answer: string,
): Promise<void> {
  const input = findAnswerInput(fixture.nativeElement);
  input.value = answer;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();

  const form = fixture.nativeElement.querySelector('app-flashcard-answer-check form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
}

describe('FlashcardReviewComponent partial-credit recall', () => {
  let updateSrsLevel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    updateSrsLevel = vi.fn().mockResolvedValue(CARD);

    await TestBed.configureTestingModule({
      imports: [FlashcardReviewComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              if (params && 'interval' in params) return `Good · ${String(params['interval'])}`;
              return key;
            },
          },
        },
        {
          provide: VocabularyStore,
          useValue: {
            pendingReviewCards: () => [CARD, SECOND_CARD],
            updateSrsLevel,
            loadAllFlashcards: vi.fn().mockResolvedValue(undefined),
            loadDueReviews: vi.fn().mockResolvedValue(undefined),
            isDegraded: () => false,
            degradedReason: () => '',
          },
        },
        { provide: HapticFeedbackService, useValue: { trigger: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('maps a minor typo to partial credit and the Good SRS transition', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', [CARD, SECOND_CARD]);
    fixture.detectChanges();

    await submitTypedAnswer(fixture, 'abundnat');

    expect(fixture.componentInstance.isFlipped()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('review.goodAriaLabel');

    const suggestedButton = fixture.nativeElement.querySelector(
      'app-flashcard-answer-check button',
    ) as HTMLButtonElement;
    suggestedButton.click();
    await fixture.whenStable();

    expect(updateSrsLevel).toHaveBeenCalledWith('card-1', 2);
    expect(fixture.componentInstance.sessionStats().good).toBe(1);
    expect(fixture.componentInstance.currentIndex()).toBe(1);
  });

  it('maps an exact answer to Known while preserving manual override controls', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', [CARD, SECOND_CARD]);
    fixture.detectChanges();

    await submitTypedAnswer(fixture, 'ABUNDANT!');

    expect(fixture.nativeElement.textContent).toContain('review.knownAriaLabel');
    expect(fixture.nativeElement.querySelector('[role="group"]')).toBeTruthy();

    const suggestedButton = fixture.nativeElement.querySelector(
      'app-flashcard-answer-check button',
    ) as HTMLButtonElement;
    suggestedButton.click();
    await fixture.whenStable();

    expect(updateSrsLevel).toHaveBeenCalledWith('card-1', 4);
  });

  it('maps a materially wrong answer to Again', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', [CARD, SECOND_CARD]);
    fixture.detectChanges();

    await submitTypedAnswer(fixture, 'scarce');

    expect(fixture.nativeElement.textContent).toContain('review.againAriaLabel');
    const suggestedButton = fixture.nativeElement.querySelector(
      'app-flashcard-answer-check button',
    ) as HTMLButtonElement;
    suggestedButton.click();
    await fixture.whenStable();

    expect(updateSrsLevel).toHaveBeenCalledWith('card-1', 0);
  });

  it('keeps legacy reveal-and-self-grade review available without typing', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', [CARD, SECOND_CARD]);
    fixture.detectChanges();

    fixture.componentInstance.flipCard();
    fixture.detectChanges();

    expect(fixture.componentInstance.isFlipped()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="group"]')).toBeTruthy();
    expect(updateSrsLevel).not.toHaveBeenCalled();
  });
});
