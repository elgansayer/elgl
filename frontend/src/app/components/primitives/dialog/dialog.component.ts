import { Component, ChangeDetectionStrategy, input, output, computed, effect } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

/**
 * Shared accessible dialog shell (backdrop, focus trap, scroll lock,
 * ESC/backdrop dismiss, ARIA dialog wiring) - built on @angular/cdk's
 * CdkTrapFocus rather than the full CDK Overlay service, since every
 * existing hand-rolled modal already uses that same declarative
 * open-signal-in-template pattern (see report-user-modal, the first
 * migration target). Consumers keep their own header/body/actions markup
 * and drop only the backdrop + positioning + focus-trap wrapper divs this
 * replaces.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dialog',
  imports: [CdkTrapFocus],
  template: `
    @if (open()) {
      <!--
        The backdrop is intentionally not an independent keyboard tab stop -
        Escape (handled here) is the keyboard equivalent of a backdrop
        click, not tabbing to an invisible scrim and pressing Enter on it.
        The actual interactive content lives in the focus-trapped panel.
      -->
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        (click)="onBackdropClick()"
        (keydown.escape)="onEscape()"
      >
        <!--
          Click here only stops the backdrop click from bubbling and closing
          the dialog - it's not an interactive affordance a keyboard user
          needs a key-event equivalent for, they navigate the dialog's real
          content directly.
        -->
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
        <div
          [class]="panelClasses()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId() || null"
          cdkTrapFocus
          cdkTrapFocusAutoCapture
          (click)="$event.stopPropagation()"
        >
          <ng-content />
        </div>
      </div>
    }
  `,
  host: {
    '[style.display]': "'contents'",
  },
})
export class AppDialogComponent {
  readonly open = input<boolean>(false);
  readonly titleId = input<string>('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly dismissible = input<boolean>(true);
  readonly customClass = input<string>('');

  readonly dismissed = output<void>();

  readonly panelClasses = computed(() => {
    const base =
      'w-full mx-auto bg-surface-200 rounded-t-sheet sm:rounded-sheet shadow-lift border border-surface-100 max-h-[90vh] flex flex-col';
    const sizeClass =
      this.size() === 'sm' ? 'sm:max-w-sm' : this.size() === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md';
    const extra = this.customClass();
    return `${base} ${sizeClass}${extra ? ' ' + extra : ''}`.trim();
  });

  constructor() {
    // Scroll-lock the page while any dialog instance is open.
    effect((onCleanup) => {
      if (this.open()) {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        onCleanup(() => {
          document.body.style.overflow = previousOverflow;
        });
      }
    });
  }

  onBackdropClick(): void {
    if (this.dismissible()) {
      this.dismissed.emit();
    }
  }

  onEscape(): void {
    if (this.dismissible()) {
      this.dismissed.emit();
    }
  }
}
