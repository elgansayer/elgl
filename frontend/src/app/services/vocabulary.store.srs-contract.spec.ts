import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { HtmlSanitisationService } from './html-sanitisation.service';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard, VocabularyStore } from './vocabulary.store';

describe('VocabularyStore SRS colour contract', () => {
  let store: VocabularyStore;

  const makeFlashcard = (srsLevel: number, wordToken = 'hello'): Flashcard => ({
    id: `card-${srsLevel}`,
    user_id: 'user-1',
    word_token: wordToken,
    translation: 'hola',
    srs_level: srsLevel,
    easiness_factor: 2.5,
    repetitions: 0,
    interval_days: 0,
    next_review_at: '2026-08-21T00:00:00.000Z',
    created_at: '2026-08-21T00:00:00.000Z',
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        VocabularyStore,
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('test-token') },
        },
        {
          provide: SrsOfflineService,
          useValue: {
            online: vi.fn().mockReturnValue(true),
            cacheFlashcards: vi.fn().mockResolvedValue(undefined),
            cacheDueReviews: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: HtmlSanitisationService,
          useValue: {
            sanitiseText: (value: string) => value,
            sanitiseUrl: (value: string) => value,
          },
        },
        {
          provide: ErrorHandler,
          useValue: { handleError: vi.fn() },
        },
      ],
    });

    store = TestBed.inject(VocabularyStore);
  });

  it('uses an Angular signal Map as the authoritative token lookup', () => {
    expect(store.flashcardMap()).toBeInstanceOf(Map);
    expect(store.flashcardMap().size).toBe(0);

    const learningCard = makeFlashcard(2, 'Hello');
    store.flashcardMap.set(new Map([['hello', learningCard]]));

    expect(store.getWordStatus('hello').flashcard).toEqual(learningCard);

    const knownCard = makeFlashcard(4, 'Hello');
    store.flashcardMap.update((current) => {
      const next = new Map(current);
      next.set('hello', knownCard);
      return next;
    });

    expect(store.getWordStatus('hello').level).toBe(4);
    expect(store.getWordStatus('hello').flashcard).toEqual(knownCard);
  });

  it('maps unknown tokens to level 0 with the new-word secondary treatment', () => {
    const status = store.getWordStatus('new-word');

    expect(status.level).toBe(0);
    expect(status.flashcard).toBeUndefined();
    expect(status.colourClass).toContain('bg-secondary/20');
    expect(status.colourClass).toContain('border-secondary');
    expect(status.colorClass).toBe(status.colourClass);
  });

  it.each([1, 2, 3])('maps SRS level %i to the learning warning treatment', (level) => {
    const card = makeFlashcard(level);
    store.flashcardMap.set(new Map([['hello', card]]));

    const status = store.getWordStatus('hello');

    expect(status.level).toBe(level);
    expect(status.flashcard).toEqual(card);
    expect(status.colourClass).toContain('bg-warning/20');
    expect(status.colourClass).toContain('border-warning');
    expect(status.colorClass).toBe(status.colourClass);
  });

  it('maps SRS level 4 to the known-word normal text treatment', () => {
    const card = makeFlashcard(4);
    store.flashcardMap.set(new Map([['hello', card]]));

    const status = store.getWordStatus('hello');

    expect(status.level).toBe(4);
    expect(status.flashcard).toEqual(card);
    expect(status.colourClass).toContain('text-text-primary');
    expect(status.colourClass).not.toContain('bg-warning/20');
    expect(status.colourClass).not.toContain('bg-secondary/20');
  });

  it('normalises lookup casing and surrounding whitespace without changing stored tokens', () => {
    const card = makeFlashcard(3, 'Hello');
    store.flashcardMap.set(new Map([['hello', card]]));

    const status = store.getWordStatus('  HeLLo  ');

    expect(status.level).toBe(3);
    expect(status.flashcard?.word_token).toBe('Hello');
    expect(store.flashcardMap().has('hello')).toBe(true);
    expect(store.flashcardMap().has('  hello  ')).toBe(false);
  });

  it('keeps the list and review collections as independently writable signals', () => {
    const card = makeFlashcard(1);

    store.allFlashcards.set([card]);
    store.dueReviews.set([card]);

    expect(store.allFlashcards()).toEqual([card]);
    expect(store.dueReviews()).toEqual([card]);
  });
});
