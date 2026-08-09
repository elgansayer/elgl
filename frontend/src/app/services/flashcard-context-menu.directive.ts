import { Directive, inject, input, ElementRef, ErrorHandler } from '@angular/core';
import { FlashcardService } from './flashcard.service';

@Directive({
  selector: '[appFlashcardContextMenu]',
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(touchstart)': 'onTouchStart($event)',
  },
})
export class FlashcardContextMenuDirective {
  /** Source language of the selected text (could be read from a data attribute or input). */
  readonly sourceLanguage = input<string>('en');

  private flashcardService = inject(FlashcardService);
  private elRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private errorHandler = inject(ErrorHandler);

  private overlay: HTMLElement | null = null;

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.removeOverlay();

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }
    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return;
    }

    const contextText = this.elRef.nativeElement.textContent ?? '';
    const lang = this.sourceLanguage();

    this.showOverlay(event.clientX, event.clientY, selectedText, contextText, lang);
  }

  onTouchStart(_event: TouchEvent): void {
    /* long-press detection could be added later */
  }

  private showOverlay(x: number, y: number, word: string, context: string, lang: string): void {
    const div = document.createElement('div');
    div.className = 'fixed bg-surface text-on-surface shadow-lg rounded-lg px-4 py-2 z-50 cursor-pointer hover:bg-surface-hover transition-colors';
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.textContent = 'Create Flashcard';

    div.addEventListener('click', async () => {
      try {
        await this.flashcardService.createFlashcard({
          word_token: word,
          original_context: context,
          translation: word,
        });
        // Notify user with a toast if implemented
      } catch (err) {
        this.reportError('createFlashcard', err);
        // Show error toast
      }
      this.removeOverlay();
    });

    this.overlay = div;
    document.body.appendChild(div);

    const closeHandler: EventListener = (e: Event) => {
      const target = e.target;
      if (!target || !(target instanceof Node)) {
        return;
      }
      if (!div.contains(target)) {
        document.removeEventListener('click', closeHandler);
        this.removeOverlay();
      }
    };

    // Delay to avoid immediate close from the context menu event itself
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  private removeOverlay(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  private reportError(operation: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const ctxError = new Error(`[SRS:FlashcardContextMenu] ${operation} failed: ${message}`);
    if (err instanceof Error && err.stack) {
      ctxError.stack = err.stack;
    }
    this.errorHandler.handleError(ctxError);
  }
}
