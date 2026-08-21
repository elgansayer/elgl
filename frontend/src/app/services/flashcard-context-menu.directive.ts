import { Directive, ElementRef, OnDestroy, inject, input, output } from '@angular/core';

const LONG_PRESS_MS = 650;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;

export interface FlashcardSelectionRequest {
  text: string;
  context: string;
  sourceLanguage?: string;
}

@Directive({
  selector: '[appFlashcardContextMenu]',
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd()',
    '(touchcancel)': 'onTouchEnd()',
  },
})
export class FlashcardContextMenuDirective implements OnDestroy {
  /** Optional language hint associated with the source content. */
  readonly sourceLanguage = input<string | undefined>(undefined);
  /** Exact source context to persist with the card instead of derived rendered text. */
  readonly selectionContext = input<string | undefined>(undefined);
  /** Requests that the host open its accessible flashcard action surface. */
  readonly flashcardSelection = output<FlashcardSelectionRequest>();

  private readonly elRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartPoint: { x: number; y: number } | null = null;

  onContextMenu(event: MouseEvent): void {
    this.clearLongPressTimer();
    const selection = this.getOwnedSelection();
    if (!selection) return;

    event.preventDefault();
    event.stopPropagation();
    this.flashcardSelection.emit(selection);
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      this.clearLongPressTimer();
      return;
    }

    // Selected-text long press is a separate interaction from the surrounding
    // whole-message menu. Do not preventDefault: native scrolling and text
    // selection must continue to work.
    event.stopPropagation();
    const touch = event.touches[0];
    this.touchStartPoint = { x: touch.clientX, y: touch.clientY };
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      const selection = this.getOwnedSelection();
      if (selection) this.flashcardSelection.emit(selection);
    }, LONG_PRESS_MS);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.touchStartPoint || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - this.touchStartPoint.x;
    const dy = touch.clientY - this.touchStartPoint.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
      this.clearLongPressTimer();
    }
  }

  onTouchEnd(): void {
    this.clearLongPressTimer();
    this.touchStartPoint = null;
  }

  ngOnDestroy(): void {
    this.clearLongPressTimer();
  }

  private getOwnedSelection(): FlashcardSelectionRequest | null {
    if (typeof window === 'undefined') return null;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const host = this.elRef.nativeElement;
    if (!this.containsNode(host, range.startContainer) || !this.containsNode(host, range.endContainer)) {
      return null;
    }

    const text = selection.toString().trim();
    if (!text) return null;

    return {
      text,
      context: (this.selectionContext() ?? host.textContent ?? '').trim(),
      sourceLanguage: this.sourceLanguage()?.trim() || undefined,
    };
  }

  private containsNode(host: HTMLElement, node: Node): boolean {
    const candidate = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return node === host || (candidate !== null && host.contains(candidate));
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
