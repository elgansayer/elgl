import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatService } from './chat.service';
import { FlashcardContextMenuDirective } from './flashcard-context-menu.directive';
import { FlashcardService } from './flashcard.service';
import { I18nService } from './i18n.service';

@Component({
  imports: [FlashcardContextMenuDirective],
  template: `
    <button id="before" type="button">Before</button>
    <p
      id="source"
      appFlashcardContextMenu
      sourceLanguage="es"
      targetLanguage="en"
      selectionContext="Hola brave mundo"
    >
      Hola brave mundo
    </p>
    <p id="outside">Outside text</p>
  `,
})
class HostComponent {}

describe('FlashcardContextMenuDirective', () => {
  const createFlashcard = vi.fn();
  const translateText = vi.fn();
  const handleError = vi.fn();

  beforeEach(async () => {
    createFlashcard.mockReset().mockResolvedValue({ id: 'card-1' });
    translateText.mockReset().mockResolvedValue({ translated_text: 'hello brave world' });
    handleError.mockReset();

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: FlashcardService, useValue: { createFlashcard, isDegraded: false } },
        { provide: ChatService, useValue: { translateText } },
        { provide: ErrorHandler, useValue: { handleError } },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: (key: string) => key,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    document.querySelectorAll('[data-testid="selection-flashcard-action"]').forEach((node) => node.remove());
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  function selectText(element: HTMLElement, start: number, end: number): void {
    const textNode = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (!textNode) throw new Error('Expected source text node');

    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  it('creates a flashcard from an owned desktop selection with a real translation', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);

    source.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 32,
      }),
    );

    const action = document.querySelector(
      '[data-testid="selection-flashcard-action"]',
    ) as HTMLButtonElement | null;
    expect(action).not.toBeNull();
    action?.click();

    await vi.waitFor(() => {
      expect(translateText).toHaveBeenCalledWith('brave', 'en');
      expect(createFlashcard).toHaveBeenCalledWith({
        word_token: 'brave',
        original_context: 'Hola brave mundo',
        translation: 'hello brave world',
      });
    });
  });

  it('does not offer the action for collapsed or out-of-element selections', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const outside = fixture.nativeElement.querySelector('#outside') as HTMLElement;

    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-testid="selection-flashcard-action"]')).toBeNull();

    selectText(outside, 0, 7);
    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-testid="selection-flashcard-action"]')).toBeNull();
  });

  it('prevents duplicate in-flight creates', async () => {
    let resolveTranslation!: (value: { translated_text: string }) => void;
    translateText.mockReturnValue(
      new Promise<{ translated_text: string }>((resolve) => {
        resolveTranslation = resolve;
      }),
    );

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);
    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const action = document.querySelector(
      '[data-testid="selection-flashcard-action"]',
    ) as HTMLButtonElement;
    action.click();
    action.click();
    expect(translateText).toHaveBeenCalledTimes(1);
    expect(action.disabled).toBe(true);
    expect(action.getAttribute('aria-busy')).toBe('true');

    resolveTranslation({ translated_text: 'courageous' });
    await vi.waitFor(() => expect(createFlashcard).toHaveBeenCalledTimes(1));
  });

  it('dismisses on Escape and restores prior focus', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const before = fixture.nativeElement.querySelector('#before') as HTMLButtonElement;
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    before.focus();
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);
    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(document.activeElement?.getAttribute('data-testid')).toBe('selection-flashcard-action');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.querySelector('[data-testid="selection-flashcard-action"]')).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it('supports mobile long-press selection without starting the outer message gesture', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const sourceDebug = fixture.debugElement.query(By.directive(FlashcardContextMenuDirective));
    const directive = sourceDebug.injector.get(FlashcardContextMenuDirective);
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);

    const stopPropagation = vi.fn();
    directive.onTouchStart({
      touches: [{ clientX: 20, clientY: 30 }],
      stopPropagation,
    } as unknown as TouchEvent);
    vi.advanceTimersByTime(650);

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-testid="selection-flashcard-action"]')).not.toBeNull();
  });

  it('keeps the action available after a translation failure and reports the error', async () => {
    translateText.mockRejectedValue(new Error('provider unavailable'));
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);
    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const action = document.querySelector(
      '[data-testid="selection-flashcard-action"]',
    ) as HTMLButtonElement;
    action.click();

    await vi.waitFor(() => expect(handleError).toHaveBeenCalledOnce());
    expect(createFlashcard).not.toHaveBeenCalled();
    expect(action.disabled).toBe(false);
    expect(action.hasAttribute('aria-busy')).toBe(false);
  });
});
