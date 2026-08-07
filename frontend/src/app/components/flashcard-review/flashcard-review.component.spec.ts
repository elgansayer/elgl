import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FlashcardReviewComponent } from './flashcard-review.component';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';

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

describe('FlashcardReviewComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [FlashcardReviewComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (k: string) => k } },
        {
          provide: VocabularyStore,
          useValue: {
            pendingReviewCards: () => [] as Flashcard[],
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
    expect(component.sessionStats().good).toBe(0);
    expect(component.sessionStats().again).toBe(0);
    expect(component.sessionStats().known).toBe(0);
  });
});