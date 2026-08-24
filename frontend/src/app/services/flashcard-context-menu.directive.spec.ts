import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FLASHCARD_CONTEXT_MAX_LENGTH,
  FLASHCARD_SELECTION_MAX_LENGTH,
  FlashcardContextMenuDirective,
  type FlashcardSelectionRequest,
} from './flashcard-context-menu.directive';

@Component({
  imports: [FlashcardContextMenuDirective],
  template: `
    <p
      id="source"
      appFlashcardContextMenu
      sourceLanguage="es"
      [selectionContext]="context"
      (flashcardSelection)="requests.push($event)"
    >{{ sourceText }}</p>
    <p id="outside">Outside text</p>
  `,
})
class HostComponent {
  sourceText = 'Hola brave mundo';
  context = 'Hola brave mundo';
  readonly requests: FlashcardSelectionRequest[] = [];
}

describe('FlashcardContextMenuDirective', () => {
  afterEach(() => {
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

  it('emits an owned desktop selection with exact source context and language', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
    });
    source.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.requests).toEqual([
      {
        text: 'brave',
        context: 'Hola brave mundo',
        sourceLanguage: 'es',
      },
    ]);
  });

  it('preserves the native context menu for collapsed or out-of-element selections', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const outside = fixture.nativeElement.querySelector('#outside') as HTMLElement;

    const collapsed = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    source.dispatchEvent(collapsed);
    expect(collapsed.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.requests).toEqual([]);

    selectText(outside, 0, 7);
    const outsideSelection = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    source.dispatchEvent(outsideSelection);
    expect(outsideSelection.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.requests).toEqual([]);
  });

  it('leaves the native context menu available for selections the flashcard API cannot accept', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.sourceText = 'a'.repeat(FLASHCARD_SELECTION_MAX_LENGTH + 1);
    fixture.componentInstance.context = fixture.componentInstance.sourceText;
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    selectText(source, 0, FLASHCARD_SELECTION_MAX_LENGTH + 1);

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    source.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.requests).toEqual([]);
  });

  it('bounds persisted context while preserving the selected phrase when possible', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.context = `${'x'.repeat(700)} brave ${'y'.repeat(700)}`;
    fixture.detectChanges();
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);

    source.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(fixture.componentInstance.requests).toHaveLength(1);
    const [request] = fixture.componentInstance.requests;
    expect(request.context.length).toBeLessThanOrEqual(FLASHCARD_CONTEXT_MAX_LENGTH);
    expect(request.context).toContain('brave');
  });

  it('supports mobile long press without starting an outer message gesture', async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
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
    expect(fixture.componentInstance.requests).toEqual([
      {
        text: 'brave',
        context: 'Hola brave mundo',
        sourceLanguage: 'es',
      },
    ]);
  });

  it('cancels mobile long press after meaningful finger movement', async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const sourceDebug = fixture.debugElement.query(By.directive(FlashcardContextMenuDirective));
    const directive = sourceDebug.injector.get(FlashcardContextMenuDirective);
    const source = fixture.nativeElement.querySelector('#source') as HTMLElement;
    const sourceText = source.textContent ?? '';
    const start = sourceText.indexOf('brave');
    selectText(source, start, start + 'brave'.length);

    directive.onTouchStart({
      touches: [{ clientX: 20, clientY: 30 }],
      stopPropagation: vi.fn(),
    } as unknown as TouchEvent);
    directive.onTouchMove({
      touches: [{ clientX: 60, clientY: 30 }],
    } as unknown as TouchEvent);
    vi.advanceTimersByTime(650);

    expect(fixture.componentInstance.requests).toEqual([]);
  });
});
