import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { I18nService } from '../../services/i18n.service';
import { Flashcard, VocabularyStore } from '../../services/vocabulary.store';
import { FlashcardReviewComponent } from './flashcard-review.component';

const MOCK_CARD = {
  id: '1',
  user_id: 'u1',
  word_token: 'abundant',
  translation: '丰富的',
  definition: 'existing in large quantities',
  srs_level: 1,
  easiness_factor: 2.5,
  repetitions: 0,
  interval_days: 0,
  next_review_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as Flashcard;

const MOCK_CARDS: Flashcard[] = [
  MOCK_CARD,
  { ...MOCK_CARD, id: '2', word_token: 'benevolent' },
];

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('FlashcardReviewComponent', () => {
  let hapticTrigger: ReturnType<typeof vi.fn>;
  let updateSrsLevel: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    hapticTrigger = vi.fn();
    updateSrsLevel = vi.fn().mockResolvedValue({ ...MOCK_CARD });

    await TestBed.configureTestingModule({
      imports: [FlashcardReviewComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              if (params && 'current' in params) {
                return `Card ${params['current']} of ${params['total']}`;
              }
              if (params && 'percent' in params) return `${params['percent']}% complete`;
              if (params && 'word' in params) return `Flashcard: ${params['word']}`;
              if (params && 'interval' in params) return `Good · ${params['interval']}`;
              return key;
            },
          },
        },
        {
          provide: VocabularyStore,
          useValue: {
            pendingReviewCards: () => MOCK_CARDS,
            updateSrsLevel,
            loadAllFlashcards: vi.fn().mockResolvedValue(undefined),
            loadDueReviews: vi.fn().mockResolvedValue(undefined),
            isDegraded: () => false,
            degradedReason: () => '',
          },
        },
        {
          provide: HapticFeedbackService,
          useValue: { trigger: hapticTrigger },
        },
      ],
    }).compileComponents();
  });

  it('creates with the first review card ready', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.currentCard()?.id).toBe('1');
    expect(component.isFlipped()).toBe(false);
    expect(component.currentIndex()).toBe(0);
  });

  it('renders progress semantics for assistive technology', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();

    const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('flips the current card without grading it', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.flipCard();

    expect(component.isFlipped()).toBe(true);
    expect(hapticTrigger).not.toHaveBeenCalled();
    expect(updateSrsLevel).not.toHaveBeenCalled();
  });

  it.each([
    ['again', 'light', 0],
    ['good', 'medium', 2],
    ['known', 'selection', 4],
  ] as const)(
    'emits the %s grading haptic and persists the matching SRS level',
    async (grade, expectedHaptic, expectedLevel) => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.componentRef.setInput('cards', MOCK_CARDS);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      await component.gradeReview(grade);

      expect(hapticTrigger).toHaveBeenCalledTimes(1);
      expect(hapticTrigger).toHaveBeenCalledWith(expectedHaptic);
      expect(updateSrsLevel).toHaveBeenCalledWith('1', expectedLevel);
      expect(component.sessionStats()[grade]).toBe(1);
      expect(component.currentIndex()).toBe(1);
    },
  );

  it('keeps haptics best-effort when persistence falls back or fails', async () => {
    updateSrsLevel.mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await expect(component.gradeReview('known')).resolves.toBeUndefined();

    expect(hapticTrigger).toHaveBeenCalledWith('selection');
    expect(component.sessionStats().known).toBe(1);
    expect(component.currentIndex()).toBe(1);
  });

  it('does not emit duplicate haptics while a grade save is already in flight', async () => {
    const deferred = createDeferred<Flashcard>();
    updateSrsLevel.mockReturnValueOnce(deferred.promise);
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const firstGrade = component.gradeReview('good');
    expect(component.isSaving()).toBe(true);

    await component.gradeReview('known');
    expect(hapticTrigger).toHaveBeenCalledTimes(1);
    expect(component.sessionStats()).toEqual({ again: 0, good: 1, known: 0 });

    deferred.resolve({ ...MOCK_CARD, srs_level: 2 });
    await firstGrade;
    expect(component.currentIndex()).toBe(1);
  });

  it('reaches completion after all cards are reviewed and can restart', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.gradeReview('good');
    await component.gradeReview('known');
    expect(component.isComplete()).toBe(true);

    component.restart();
    expect(component.isComplete()).toBe(false);
    expect(component.currentIndex()).toBe(0);
    expect(component.sessionStats()).toEqual({ again: 0, good: 0, known: 0 });
  });

  describe('RTL logical CSS properties', () => {
    it('does not use physical direction utility classes in rendered content', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.componentRef.setInput('cards', MOCK_CARDS);
      fixture.detectChanges();
      fixture.componentInstance.flipCard();
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toMatch(/\b(pl-\d|pr-\d|ml-\d|mr-\d)\b/);
      expect(html).not.toContain('text-left');
      expect(html).not.toContain('text-right');
    });
  });
});
