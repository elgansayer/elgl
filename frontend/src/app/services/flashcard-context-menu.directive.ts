import {
  Directive,
  ElementRef,
  ErrorHandler,
  OnDestroy,
  inject,
  input,
} from '@angular/core';
import { FlashcardService } from './flashcard.service';
import { ChatService } from './chat.service';
import { I18nService } from './i18n.service';
import { showErrorToast, showToast } from './toast.service';

const LONG_PRESS_MS = 650;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const VIEWPORT_MARGIN_PX = 12;

interface OwnedSelection {
  text: string;
  context: string;
  range: Range;
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
  /** Language the selected phrase should be translated into before creating the card. */
  readonly targetLanguage = input<string>('en');
  /** Exact source context to persist with the card instead of derived rendered text. */
  readonly selectionContext = input<string | undefined>(undefined);

  private readonly flashcardService = inject(FlashcardService);
  private readonly chatService = inject(ChatService);
  private readonly elRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly i18n = inject(I18nService);

  private overlay: HTMLButtonElement | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartPoint: { x: number; y: number } | null = null;
  private creating = false;

  private readonly onDocumentPointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && this.overlay && !this.overlay.contains(target)) {
      this.removeOverlay();
    }
  };

  private readonly onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.overlay) {
      event.preventDefault();
      this.removeOverlay(true);
    }
  };

  onContextMenu(event: MouseEvent): void {
    this.clearLongPressTimer();
    const selection = this.getOwnedSelection();
    if (!selection) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.showOverlay(event.clientX, event.clientY, selection);
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) {
      this.clearLongPressTimer();
      return;
    }

    // A long press on selected text belongs to this interaction. Stop the outer
    // whole-message long-press menu from racing it without preventing native
    // scrolling or text selection.
    event.stopPropagation();

    const touch = event.touches[0];
    this.touchStartPoint = { x: touch.clientX, y: touch.clientY };
    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      const selection = this.getOwnedSelection();
      if (!selection || !this.touchStartPoint) return;

      const rect = selection.range.getBoundingClientRect();
      const x = rect.width > 0 ? rect.left + rect.width / 2 : this.touchStartPoint.x;
      const y = rect.height > 0 ? rect.bottom : this.touchStartPoint.y;
      this.showOverlay(x, y, selection);
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
    this.removeOverlay();
  }

  private getOwnedSelection(): OwnedSelection | null {
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
      range,
    };
  }

  private containsNode(host: HTMLElement, node: Node): boolean {
    const candidate = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return node === host || (candidate !== null && host.contains(candidate));
  }

  private showOverlay(x: number, y: number, selection: OwnedSelection): void {
    this.removeOverlay();
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset['testid'] = 'selection-flashcard-action';
    button.className =
      'fixed z-50 min-h-11 rounded-card border border-surface-100 bg-surface-200 px-4 py-2 text-sm font-bold text-text-primary shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60';
    button.textContent = this.i18n.translate('common.save');
    button.setAttribute('aria-label', `${this.i18n.translate('common.save')}: ${selection.text}`);

    button.addEventListener('click', () => {
      void this.createFlashcard(selection, button);
    });

    document.body.appendChild(button);
    this.overlay = button;
    this.positionOverlay(button, x, y);
    button.focus({ preventScroll: true });

    document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    document.addEventListener('keydown', this.onDocumentKeyDown, true);
  }

  private positionOverlay(button: HTMLButtonElement, x: number, y: number): void {
    const rect = button.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - rect.width - VIEWPORT_MARGIN_PX);
    const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - rect.height - VIEWPORT_MARGIN_PX);
    const left = Math.min(Math.max(x, VIEWPORT_MARGIN_PX), maxLeft);
    const top = Math.min(Math.max(y, VIEWPORT_MARGIN_PX), maxTop);
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
  }

  private async createFlashcard(
    selection: OwnedSelection,
    button: HTMLButtonElement,
  ): Promise<void> {
    if (this.creating) return;
    this.creating = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    try {
      const targetLanguage = this.targetLanguage().trim() || 'en';
      const translated = await this.chatService.translateText(selection.text, targetLanguage);
      const translation = translated.translated_text?.trim();
      if (!translation) {
        throw new Error('Translation provider returned an empty result');
      }

      await this.flashcardService.createFlashcard({
        word_token: selection.text,
        original_context: selection.context,
        translation,
      });

      showToast(
        this.i18n.translate('chatRoom.savedLingqAlert', {
          text: selection.text,
        }),
        'success',
      );
      this.removeOverlay();
    } catch (error) {
      this.reportError('createFlashcardFromSelection', error);
      showErrorToast(this.i18n.translate('common.error_generic'));
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.focus({ preventScroll: true });
    } finally {
      this.creating = false;
    }
  }

  private removeOverlay(restoreFocus = false): void {
    const previousOverlay = this.overlay;
    if (previousOverlay?.parentNode) {
      previousOverlay.parentNode.removeChild(previousOverlay);
    }
    this.overlay = null;
    this.creating = false;
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    document.removeEventListener('keydown', this.onDocumentKeyDown, true);

    if (restoreFocus) {
      this.previouslyFocused?.focus({ preventScroll: true });
    }
    this.previouslyFocused = null;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
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
