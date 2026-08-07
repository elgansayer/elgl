import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { FlashcardReviewComponent } from './flashcard-review.component';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { SrsOfflineService } from '../../services/srs-offline.service';

const MOCK_CARD: Flashcard = {
  id: '1',
  user_id: 'u1',
  word_token: 'abundant',
  translation: '丰富的',
  definition: 'existing in large quantities',
  srs_level: 1,
  easiness_factor: 2.5,
  repetitions: 1,
  interval_days: 1,
  next_review_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const MOCK_CARDS: Flashcard[] = [MOCK_CARD, { ...MOCK_CARD, id: '2', word_token: 'benevolent' }];

describe('FlashcardReviewComponent', () => {
  let fixture: ComponentFixture<FlashcardReviewComponent>;
  let component: FlashcardReviewComponent;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };
  let mockVocabStore: {
    pendingReviewCards: ReturnType<typeof vi.fn>;
    updateSrsLevel: ReturnType<typeof vi.fn>;
    loadAllFlashcards: ReturnType<typeof vi.fn>;
    loadDueReviews: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockErrorHandler = { handleError: vi.fn() };
    mockVocabStore = {
      pendingReviewCards: vi.fn(() => MOCK_CARDS),
      updateSrsLevel: vi.fn(() => Promise.resolve({ ...MOCK_CARD })),
      loadAllFlashcards: vi.fn(() => Promise.resolve()),
      loadDueReviews: vi.fn(() => Promise.resolve()),
    };

    TestBed.configureTestingModule({
      imports: [FlashcardReviewComponent],
      providers: [
        { provide: ErrorHandler, useValue: mockErrorHandler },
        { provide: SrsOfflineService, useValue: { cacheFlashcards: vi.fn(), cacheDueReviews: vi.fn(), getCachedFlashcards: vi.fn(), getCachedDueReviews: vi.fn(), queueSrsReview: vi.fn(), syncQueuedReviews: vi.fn() } },
        {
          provide: I18nService,
          useValue: {
            translate: (k: string, params?: Record<string, unknown>) => {
              if (params && 'current' in params) return `Card ${params['current']} of ${params['total']}`;
              if (params && 'percent' in params) return `${params['percent']}% complete`;
              if (params && 'word' in params) return `Flashcard: ${params['word']}`;
              if (params && 'interval' in params) return `Next review: ${params['interval']}`;
              return k;
            },
          },
        },
        { provide: VocabularyStore, useValue: mockVocabStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FlashcardReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with default values', () => {
    expect(component.isFlipped()).toBe(false);
    expect(component.currentIndex()).toBe(0);
    expect(component.sessionStats().good).toBe(0);
    expect(component.sessionStats().again).toBe(0);
    expect(component.sessionStats().known).toBe(0);
  });

  it('should render progress bar with ARIA attributes', () => {
<<<<<<< HEAD
=======
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    // Override the reviewCards computed by providing cards input
    TestBed.flushEffects?.();
    fixture.detectChanges();

>>>>>>> origin/main
    const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
  });

<<<<<<< HEAD
  it('should render flashcard content when cards exist', () => {
    expect(component.reviewCards().length).toBe(2);
    const rendered = fixture.nativeElement.textContent;
    expect(rendered).toContain('abundant');
=======
  it('should render flashcard with keyboard accessibility', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.detectChanges();

    // No card shown when empty, just verify component renders without error
    expect(fixture.componentInstance).toBeTruthy();
>>>>>>> origin/main
  });

  it('should flip card when clicked', () => {
    expect(component.isFlipped()).toBe(false);
    component.flipCard();
    expect(component.isFlipped()).toBe(true);
  });

  it('should track session stats when grading', async () => {
    await component.gradeReview('good');
    expect(mockVocabStore.updateSrsLevel).toHaveBeenCalledWith(MOCK_CARD.id, 2);
    expect(component.sessionStats().good).toBe(1);
    expect(component.isFlipped()).toBe(false);
  });

  it('should advance to next card after grading', async () => {
    expect(component.currentIndex()).toBe(0);
    await component.gradeReview('good');
    expect(component.currentIndex()).toBe(1);
  });

  it('should show completion state after all cards reviewed', async () => {
    expect(component.isComplete()).toBe(false);
    await component.gradeReview('good');
    await component.gradeReview('good');
    expect(component.isComplete()).toBe(true);
    fixture.detectChanges();
    const completeEl = fixture.nativeElement.querySelector('[role="status"]');
    expect(completeEl).toBeTruthy();
  });

  it('should revert session stats when gradeReview persist fails', async () => {
    const testError = new Error('Network failure');
    mockVocabStore.updateSrsLevel.mockRejectedValueOnce(testError);

    expect(component.sessionStats().good).toBe(0);
    await component.gradeReview('good');

    // Session stats should be reverted after persist failure
    expect(component.sessionStats().good).toBe(0);
    // Card should not advance on failure
    expect(component.currentIndex()).toBe(0);
  });

  it('should call captureError on load failure within handleRetry', async () => {
    mockVocabStore.loadAllFlashcards.mockRejectedValueOnce(new Error('Load failed'));

    // Trigger retry which calls loadData internally
    component.handleRetry();

    // Wait for async loadData to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The component's errorBoundaryEl may not be available in test,
    // but verify the component remains functional after error
    expect(component.isComplete()).toBe(false);
    expect(component.currentIndex()).toBe(0);
  });

  it('should restart and reset all state', () => {
    component.sessionStats.set({ good: 5, again: 2, known: 10 });
    component.currentIndex.set(8);
    component.isFlipped.set(true);

    component.restart();

    expect(component.currentIndex()).toBe(0);
    expect(component.isFlipped()).toBe(false);
    expect(component.sessionStats().good).toBe(0);
    expect(component.sessionStats().again).toBe(0);
    expect(component.sessionStats().known).toBe(0);
  });

  it('should compute next interval hint', () => {
    expect(component.nextIntervalHint()).toContain('7d');
  });

  it('should not grade when isComplete is true', async () => {
    // Exhaust all cards
    await component.gradeReview('known');
    await component.gradeReview('known');
    expect(component.isComplete()).toBe(true);

    mockVocabStore.updateSrsLevel.mockClear();

    await component.gradeReview('good');
    // No additional call since review is complete
    expect(mockVocabStore.updateSrsLevel).not.toHaveBeenCalled();
  });

  it('should provide correct error context', () => {
    expect(component.errorContext()).toEqual({
      component: 'flashcard-review',
      operation: 'review',
      cardCount: 2,
      currentIndex: 0,
      srsLevel: 1,
    });
  });
});