import { Directive, inject, input, ElementRef, OnDestroy } from '@angular/core';
import { FlashcardService } from './flashcard.service';

@Directive({
  selector: '[appFlashcardContextMenu]',
  standalone: true,
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(touchstart)': 'onTouchStart($event)',
  },
})
export class FlashcardContextMenuDirective implements OnDestroy {
  /** Source language of the selected text (could be read from a data attribute or input). */
  readonly sourceLanguage = input<string>('en');

  private flashcardService = inject(FlashcardService);
  private elRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private overlay: HTMLElement | null = null;
  private clickOffHandler: ((e: MouseEvent) => void) | null = null;

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

  ngOnDestroy(): void {
    this.removeOverlay();
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
          word,
          sourceLanguage: lang,
          contextSentence: context,
        });
      } catch {
        // Failed to create flashcard - silently handled
      }
      this.removeOverlay();
    });

    this.overlay = div;
    document.body.appendChild(div);

    // Clean up previous handler before adding a new one
    if (this.clickOffHandler) {
      document.removeEventListener('click', this.clickOffHandler);
    }

    this.clickOffHandler = (e: MouseEvent) => {
      const target = e.target;
      if (!target || !(target instanceof Node)) {
        return;
      }
      if (!div.contains(target)) {
        this.removeOverlay();
      }
    };

    // Delay attachment to avoid immediate close from the current contextmenu event
    requestAnimationFrame(() => {
      if (this.clickOffHandler) {
        document.addEventListener('click', this.clickOffHandler);
      }
    });
  }

  private removeOverlay(): void {
    if (this.clickOffHandler) {
      document.removeEventListener('click', this.clickOffHandler);
      this.clickOffHandler = null;
    }
    if (this.overlay?.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }
}
