import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FlashcardReviewComponent } from './flashcard-review.component';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

const MOCK_CARD: Flashcard = {
  id: '1',
  user_id: 'u1',
  word_token: 'abundant',
  translation: '丰富的',
  definition: 'existing in large quantities',
  srs_level: 1,
  next_review_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const MOCK_CARDS: Flashcard[] = [MOCK_CARD, { ...MOCK_CARD, id: '2', word_token: 'benevolent' }];

const createTranslateService = () => ({
  translate: (k: string, params?: Record<string, unknown>) => {
    if (params && 'current' in params) return `Card ${params['current']} of ${params['total']}`;
    if (params && 'percent' in params) return `${params['percent']}% complete`;
    if (params && 'word' in params) return `Flashcard: ${params['word']}`;
    if (params && 'count' in params) return `${params['count']}`;
    return k;
  },
});

describe('FlashcardReviewComponent', () => {
  describe('with cards', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();

      TestBed.configureTestingModule({
        imports: [FlashcardReviewComponent, AppSkeletonLoaderComponent, AppEmptyStateComponent],
        providers: [
          provideRouter([]),
          { provide: I18nService, useValue: createTranslateService() },
          {
            provide: VocabularyStore,
            useValue: {
              pendingReviewCards: () => MOCK_CARDS,
              updateSrsLevel: () => Promise.resolve({ ...MOCK_CARD }),
            },
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
      expect(component.isLoading()).toBe(false);
      expect(component.sessionStats().good).toBe(0);
      expect(component.sessionStats().again).toBe(0);
      expect(component.sessionStats().known).toBe(0);
    });

    it('should render progress bar with ARIA attributes', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      fixture.componentInstance.reviewCards; // trigger computation
      fixture.detectChanges();
      const progressBar = fixture.nativeElement.querySelector('[role="progressbar"]');
      expect(progressBar).toBeTruthy();
      expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
    });

    it('should flip card when clicked', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.isFlipped()).toBe(false);
      component.flipCard();
      expect(component.isFlipped()).toBe(true);
    });
  });

  describe('skeleton loader and empty states', () => {
    it('should show skeleton loader when isLoading is true', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [FlashcardReviewComponent, AppSkeletonLoaderComponent, AppEmptyStateComponent],
        providers: [
          provideRouter([]),
          { provide: I18nService, useValue: createTranslateService() },
          {
            provide: VocabularyStore,
            useValue: {
              pendingReviewCards: () => [],
              updateSrsLevel: () => Promise.resolve({ ...MOCK_CARD }),
            },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      const component = fixture.componentInstance;
      component.isLoading.set(true);
      fixture.detectChanges();

      const skeletonSection = fixture.nativeElement.querySelector('[role="status"]');
      expect(skeletonSection).toBeTruthy();
    });

    it('should show empty state when no review cards available', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [FlashcardReviewComponent, AppSkeletonLoaderComponent, AppEmptyStateComponent],
        providers: [
          provideRouter([]),
          { provide: I18nService, useValue: createTranslateService() },
          {
            provide: VocabularyStore,
            useValue: {
              pendingReviewCards: () => [],
              updateSrsLevel: () => Promise.resolve({ ...MOCK_CARD }),
            },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      const component = fixture.componentInstance;
      component.isLoading.set(false);
      fixture.detectChanges();

      // Should show empty state (app-empty-state or completion state)
      expect(component.isComplete()).toBe(true);
    });
  });

  describe('with empty cards', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [FlashcardReviewComponent, AppSkeletonLoaderComponent, AppEmptyStateComponent],
        providers: [
          provideRouter([]),
          { provide: I18nService, useValue: createTranslateService() },
          {
            provide: VocabularyStore,
            useValue: {
              pendingReviewCards: () => [],
              updateSrsLevel: () => Promise.resolve({ ...MOCK_CARD }),
            },
          },
        ],
      }).compileComponents();
    });

    it('should show completion state after all cards reviewed', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.isComplete()).toBe(true);
    });

    it('should have isLoading defaulting to false', () => {
      const fixture = TestBed.createComponent(FlashcardReviewComponent);
      const component = fixture.componentInstance;
      expect(component.isLoading()).toBe(false);
    });
  });
});