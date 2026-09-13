import { ErrorHandler, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';
import { Flashcard, TranslationResult, VocabularyStore } from '../../services/vocabulary.store';
import { WordDefinitionModalComponent } from './word-definition-modal.component';

const flashcard = (overrides: Partial<Flashcard> = {}): Flashcard => ({
  id: 'card-1',
  user_id: 'user-1',
  word_token: 'hola',
  translation: 'hello',
  srs_level: 0,
  easiness_factor: 2.5,
  repetitions: 0,
  interval_days: 0,
  next_review_at: '2026-08-22T00:00:00.000Z',
  created_at: '2026-08-21T00:00:00.000Z',
  ...overrides,
});

const translatedResult: TranslationResult = {
  original_text: 'hola',
  translated_text: 'hello',
  detected_language: 'es',
  transliteration: 'hola',
  definition: 'A greeting.',
  pronunciation_url: 'https://example.com/hola.mp3',
};

describe('WordDefinitionModalComponent', () => {
  let fixture: ComponentFixture<WordDefinitionModalComponent>;
  let component: WordDefinitionModalComponent;
  let vocabStore: {
    getWordStatus: ReturnType<typeof vi.fn>;
    translateWordOrSentence: ReturnType<typeof vi.fn>;
    saveWord: ReturnType<typeof vi.fn>;
    updateSrsLevel: ReturnType<typeof vi.fn>;
  };
  let errorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vocabStore = {
      getWordStatus: vi.fn().mockReturnValue({ level: 0, colorClass: '', colourClass: '' }),
      translateWordOrSentence: vi.fn().mockResolvedValue(translatedResult),
      saveWord: vi.fn().mockResolvedValue(flashcard()),
      updateSrsLevel: vi.fn().mockImplementation(async (_id: string, quality: number) =>
        flashcard({ srs_level: quality >= 5 ? 4 : quality >= 3 ? 1 : 0 }),
      ),
    };
    errorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [WordDefinitionModalComponent],
      providers: [
        { provide: VocabularyStore, useValue: vocabStore },
        {
          provide: HtmlSanitisationService,
          useValue: {
            sanitiseText: (value: string) => value,
            sanitiseUrl: (value: string) => (value.startsWith('https://') ? value : ''),
          },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: (key: string) => key,
          },
        },
        { provide: ErrorHandler, useValue: errorHandler },
      ],
    }).compileComponents();
  });

  function createComponent(word = 'hola'): void {
    fixture = TestBed.createComponent(WordDefinitionModalComponent);
    fixture.componentRef.setInput('wordToken', word);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('waits until inputs are bound before starting the lookup', async () => {
    createComponent();
    await fixture.whenStable();

    expect(vocabStore.translateWordOrSentence).toHaveBeenCalledWith('hola', 'en');
    expect(component.translationResult()?.translated_text).toBe('hello');
    expect(component.lookupFailed()).toBe(false);
  });

  it('uses an explicit translation target when supplied', async () => {
    fixture = TestBed.createComponent(WordDefinitionModalComponent);
    fixture.componentRef.setInput('wordToken', 'hello');
    fixture.componentRef.setInput('targetLanguage', 'ja');
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(vocabStore.translateWordOrSentence).toHaveBeenCalledWith('hello', 'ja');
  });

  it('fails closed when the translation provider returns its degraded placeholder', async () => {
    vocabStore.translateWordOrSentence.mockResolvedValue({
      original_text: 'hola',
      translated_text: 'hola',
      detected_language: 'es',
      definition: 'Translation service is currently unavailable',
    });

    createComponent();
    await fixture.whenStable();

    expect(component.lookupFailed()).toBe(true);
    expect(component.translationResult()).toBeNull();
    expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
    expect(String(errorHandler.handleError.mock.calls[0][0].message)).not.toContain('hola');
  });

  it('keeps the modal open when an SRS update fails so the user can retry', async () => {
    const existing = flashcard({ srs_level: 1 });
    vocabStore.getWordStatus.mockReturnValue({
      level: 1,
      colorClass: '',
      colourClass: '',
      flashcard: existing,
    });
    vocabStore.updateSrsLevel.mockRejectedValueOnce(new Error('network failure'));

    createComponent();
    await fixture.whenStable();
    const closed = vi.fn();
    component.closed.subscribe(closed);

    await component.setLevel(4);

    expect(component.saveFailed()).toBe(true);
    expect(closed).not.toHaveBeenCalled();
    expect(component.existingCard()?.id).toBe(existing.id);
  });

  it('reuses a newly-created card after a partial create/update failure', async () => {
    const created = flashcard({ id: 'created-card', srs_level: 0 });
    vocabStore.saveWord.mockResolvedValue(created);
    vocabStore.updateSrsLevel
      .mockRejectedValueOnce(new Error('temporary patch failure'))
      .mockResolvedValueOnce(flashcard({ id: 'created-card', srs_level: 4 }));

    createComponent();
    await fixture.whenStable();

    await component.setLevel(4);
    expect(component.saveFailed()).toBe(true);
    expect(component.existingCard()?.id).toBe('created-card');

    await component.setLevel(4);

    expect(vocabStore.saveWord).toHaveBeenCalledTimes(1);
    expect(vocabStore.updateSrsLevel).toHaveBeenCalledTimes(2);
    expect(component.existingCard()?.srs_level).toBe(4);
  });

  it('emits the updated card and closes only after a successful save', async () => {
    createComponent();
    await fixture.whenStable();
    const changed = vi.fn();
    const closed = vi.fn();
    component.statusChanged.subscribe(changed);
    component.closed.subscribe(closed);

    await component.setLevel(1);

    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].srs_level).toBe(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(component.saveFailed()).toBe(false);
  });

  it('bounds saved context and strips unsafe pronunciation URLs', async () => {
    vocabStore.translateWordOrSentence.mockResolvedValue({
      ...translatedResult,
      pronunciation_url: 'javascript:alert(1)',
    });

    fixture = TestBed.createComponent(WordDefinitionModalComponent);
    fixture.componentRef.setInput('wordToken', 'hola');
    fixture.componentRef.setInput('contextSentence', 'x'.repeat(3_000));
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.translationResult()?.pronunciation_url).toBeUndefined();
    await component.setLevel(0);

    expect(vocabStore.saveWord).toHaveBeenCalledWith(
      expect.objectContaining({
        original_context: 'x'.repeat(2_000),
        pronunciation_url: undefined,
      }),
    );
  });
});
