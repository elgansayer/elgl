import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from '../../services/chat.service';
import {
  FLASHCARD_CONTEXT_MAX_LENGTH,
  FLASHCARD_SELECTION_MAX_LENGTH,
} from '../../services/flashcard-context-menu.directive';
import { FlashcardService } from '../../services/flashcard.service';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { TokenisedTextComponent } from './tokenised-text.component';

class I18nStub {
  readonly currentLang = signal('en-GB');

  translate(key: string, params?: Record<string, unknown>): string {
    if (params?.['text']) return `${key}:${String(params['text'])}`;
    return key;
  }
}

describe('TokenisedTextComponent selection flashcards', () => {
  const createFlashcard = vi.fn();
  const translateText = vi.fn();
  let i18n: I18nStub;

  beforeEach(async () => {
    createFlashcard.mockReset().mockResolvedValue({ id: 'card-1' });
    translateText.mockReset().mockResolvedValue({ translated_text: 'hello brave world' });
    i18n = new I18nStub();

    await TestBed.configureTestingModule({
      imports: [TokenisedTextComponent],
      providers: [
        {
          provide: VocabularyStore,
          useValue: {
            getWordStatus: () => ({ colorClass: '', colourClass: '' }),
          },
        },
        { provide: I18nService, useValue: i18n },
        { provide: TransliterationService, useValue: { transliterate: () => '' } },
        { provide: FlashcardService, useValue: { createFlashcard } },
        { provide: ChatService, useValue: { translateText } },
      ],
    }).compileComponents();
  });

  it('translates selected text into the active UI language before creating the card', async () => {
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.componentRef.setInput('text', 'Hola brave mundo');
    fixture.componentRef.setInput('language', 'es');
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openFlashcardSelection({
      text: 'brave',
      context: 'Hola brave mundo',
      sourceLanguage: 'es',
    });
    await component.createSelectionFlashcard();

    expect(translateText).toHaveBeenCalledWith('brave', 'en');
    expect(createFlashcard).toHaveBeenCalledWith({
      word_token: 'brave',
      original_context: 'Hola brave mundo',
      translation: 'hello brave world',
    });
    expect(component.flashcardSelection()).toBeNull();
    expect(component.flashcardError()).toBe(false);
  });

  it('uses the current app language instead of a hard-coded translation target', async () => {
    i18n.currentLang.set('fr');
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openFlashcardSelection({ text: 'hola', context: 'hola mundo', sourceLanguage: 'es' });

    await component.createSelectionFlashcard();

    expect(translateText).toHaveBeenCalledWith('hola', 'fr');
  });

  it('rejects oversized selections before opening the create action', () => {
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openFlashcardSelection({
      text: 'x'.repeat(FLASHCARD_SELECTION_MAX_LENGTH + 1),
      context: 'context',
    });

    expect(component.flashcardSelection()).toBeNull();
    expect(translateText).not.toHaveBeenCalled();
    expect(createFlashcard).not.toHaveBeenCalled();
  });

  it('defensively bounds persisted source context to the API contract', () => {
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openFlashcardSelection({
      text: 'hola',
      context: 'c'.repeat(FLASHCARD_CONTEXT_MAX_LENGTH + 50),
      sourceLanguage: ' es ',
    });

    expect(component.flashcardSelection()).toEqual({
      text: 'hola',
      context: 'c'.repeat(FLASHCARD_CONTEXT_MAX_LENGTH),
      sourceLanguage: 'es',
    });
  });

  it('keeps the action retryable when translation exceeds the flashcard API limit', async () => {
    translateText.mockResolvedValue({ translated_text: 't'.repeat(501) });
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openFlashcardSelection({ text: 'hola', context: 'hola mundo' });

    await component.createSelectionFlashcard();

    expect(createFlashcard).not.toHaveBeenCalled();
    expect(component.flashcardSelection()?.text).toBe('hola');
    expect(component.flashcardError()).toBe(true);
    expect(component.flashcardCreating()).toBe(false);
  });

  it('prevents duplicate in-flight creation', async () => {
    let resolveTranslation!: (value: { translated_text: string }) => void;
    translateText.mockReturnValue(
      new Promise<{ translated_text: string }>((resolve) => {
        resolveTranslation = resolve;
      }),
    );
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openFlashcardSelection({ text: 'hola', context: 'hola mundo', sourceLanguage: 'es' });

    const first = component.createSelectionFlashcard();
    const second = component.createSelectionFlashcard();
    expect(translateText).toHaveBeenCalledTimes(1);
    expect(component.flashcardCreating()).toBe(true);

    resolveTranslation({ translated_text: 'hello' });
    await Promise.all([first, second]);
    expect(createFlashcard).toHaveBeenCalledTimes(1);
  });

  it('keeps the Spartan action open and retryable when translation fails', async () => {
    translateText.mockRejectedValue(new Error('provider unavailable'));
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openFlashcardSelection({ text: 'hola', context: 'hola mundo', sourceLanguage: 'es' });

    await component.createSelectionFlashcard();

    expect(createFlashcard).not.toHaveBeenCalled();
    expect(component.flashcardSelection()?.text).toBe('hola');
    expect(component.flashcardError()).toBe(true);
    expect(component.flashcardCreating()).toBe(false);
  });

  it('does not allow dialog dismissal to clear an in-flight create', () => {
    const fixture = TestBed.createComponent(TokenisedTextComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openFlashcardSelection({ text: 'hola', context: 'hola mundo' });
    component.flashcardCreating.set(true);

    component.onFlashcardDialogStateChanged('closed');

    expect(component.flashcardSelection()?.text).toBe('hola');
  });
});
