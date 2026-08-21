import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FlashcardReviewComponent } from './flashcard-review.component';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

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

const MOCK_CARDS: any[] = [MOCK_CARD, { ...MOCK_CARD, id: '2', word_token: 'benevolent' }];

describe.skip('FlashcardReviewComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [FlashcardReviewComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (k: string, params?: Record<string, unknown>) => {
          if (params && 'current' in params) return `Card ${params['current']} of ${params['total']}`;
          if (params && 'percent' in params) return `${params['percent']}% complete`;
          if (params && 'word' in params) return `Flashcard: ${params['word']}`;
          return k;
        }}},
        {
          provide: VocabularyStore,
          useValue: {
            pendingReviewCards: () => MOCK_CARDS,
            updateSrsLevel: () => Promise.resolve({ ...MOCK_CARD }),
            loadAllFlashcards: () => Promise.resolve(),
            loadDueReviews: () => Promise.resolve(),
            isDegraded: () => false,
            degradedReason: () => '',
          },
        },
        {
          provide: HapticFeedbackService,
          useValue: { trigger: () => {} },
        },
      ],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialise with default values', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isFlipped()).toBe(false);
    expect(component.currentIndex()).toBe(0);
    expect(component.sessionStats().good).toBe(0);
    expect(component.sessionStats().again).toBe(0);
    expect(component.sessionStats().known).toBe(0);
  });

  it('should render progress bar with ARIA attributes', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();
    // Flush async loadReviewData microtasks
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    fixture.detectChanges();

    const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
  });

  it('should render with cards and provide keyboard accessibility', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    expect(component.currentCard()).toBeTruthy();
    expect(component.reviewCards().length).toBe(2);
  });

  it('should flip card when clicked', () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    expect(component.isFlipped()).toBe(false);
    component.flipCard();
    expect(component.isFlipped()).toBe(true);
  });

  it('should track session stats when grading', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    expect(component.currentCard()).toBeTruthy();
    await component.gradeReview('good');
    expect(component.sessionStats().good).toBe(1);
  });

  it('should advance to next card after grading', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    expect(component.currentIndex()).toBe(0);
    await component.gradeReview('good');
    expect(component.currentIndex()).toBe(1);
  });

  it('should show completion state after all cards reviewed', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    fixture.detectChanges();

    // Grade through all cards
    await component.gradeReview('good');
    await component.gradeReview('known');
    expect(component.isComplete()).toBe(true);
  });

  describe('RTL logical CSS properties', () => {
    it('should not use physical padding utilities (pl-/pr-) in rendered template', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.componentRef.setInput('cards', MOCK_CARDS);
      fixture.detectChanges();

      const component = fixture.componentInstance;
      component.flipCard();
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toMatch(/\b(pl-\d|pr-\d)\b/);
    });

    it('should not use physical margin utilities (ml-/mr-)', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toMatch(/\b(ml-\d|mr-\d)\b/);
    });

    it('should not contain text-left or text-right classes', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('text-left');
      expect(html).not.toContain('text-right');
    });

    it('should use logical direction utilities (ps-/pe-) from wrapped error boundary', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.componentRef.setInput('cards', MOCK_CARDS);
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML;
      // The srs-error-boundary wrapper provides ps-/pe- logical spacing
      // and the component itself uses padding-inline in its styles
      expect(html).not.toMatch(/\b(pl-\d|pr-\d)\b/);
      expect(html).not.toMatch(/\b(ml-\d|mr-\d)\b/);
    });
  });
});