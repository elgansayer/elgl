import { Directive, ElementRef, inject, afterNextRender, DestroyRef, input, effect } from '@angular/core';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ');

@Directive({
  selector: '[appFocusTrap]',
})
export class FocusTrapDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly active = input.required<boolean>();

  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      effect(() => {
        if (this.active()) {
          this.trapFocus();
        } else {
          this.restoreFocus();
        }
      });
    });
  }

  private trapFocus(): void {
    this.previouslyFocused = document.activeElement as HTMLElement;
    const container = this.el.nativeElement;
    const focusable = this.getFocusableElements(container);

    if (focusable.length > 0) {
      requestAnimationFrame(() => focusable[0].focus());
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      const currentFocusable = this.getFocusableElements(container);
      if (currentFocusable.length === 0) return;

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    this.destroyRef.onDestroy(() => {
      container.removeEventListener('keydown', handleKeyDown);
    });
  }

  private restoreFocus(): void {
    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      requestAnimationFrame(() => this.previouslyFocused?.focus());
    }
    this.previouslyFocused = null;
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null);
  }
}