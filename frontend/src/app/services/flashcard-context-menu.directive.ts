import { Directive, HostListener, inject, input, ElementRef } from '@angular/core';
import { FlashcardService } from './flashcard.service';

@Directive({
  selector: '[appFlashcardContextMenu]',
  standalone: true,
})
export class FlashcardContextMenuDirective {
  /** Source language of the selected text (could be read from a data attribute or input). */
  readonly sourceLanguage = input<string>('en');

  private flashcardService = inject(FlashcardService);
  private elRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private overlay: HTMLElement | null = null;

  @HostListener('contextmenu', ['$event'])
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

  @HostListener('touchstart', ['$event'])
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
          word,
          sourceLanguage: lang,
          contextSentence: context,
        });
        // Notify user with a toast if implemented
      } catch (err) {
        console.error('Failed to create flashcard', err);
        // Show error toast
      }
      this.removeOverlay();
    });

    this.overlay = div;
    document.body.appendChild(div);

    const closeHandler: EventListener = (e: Event) => {
      const clickTarget = e.target as Node;
      if (!div.contains(clickTarget)) {
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
}
