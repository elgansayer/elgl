import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
      selectionContext="Hola brave mundo"
      (flashcardSelection)="requests.push($event)"
    >
      Hola brave mundo
    </p>
    <p id="outside">Outside text</p>
  `,
})
class HostComponent {
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
