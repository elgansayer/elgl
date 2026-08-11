import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  ElementRef,
  viewChild,
  effect,
} from '@angular/core';

/**
 * Shared position-anchored menu shell (backdrop, ARIA menu semantics,
 * ESC/backdrop dismiss, first-item auto-focus) for the "long-press / secondary-
 * click a message" style menus - message-context-menu, chat-context-menu,
 * long-press-context-menu all hand-roll this today. Positioned at an
 * arbitrary x/y (the long-press or contextmenu event coordinates), unlike
 * app-dialog which is centred/anchored to the viewport.
 *
 * Full roving-tabindex arrow-key navigation between items (via
 * @angular/cdk/a11y ListKeyManager) is a documented follow-up, not built
 * here yet - this first pass covers ARIA roles, focus-on-open, and
 * ESC/backdrop dismiss, which is a real improvement over today's hand-rolled
 * menus (none of which set role="menu"/"menuitem" or move focus at all).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-context-menu',
  template: `
    @if (open()) {
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div
        class="fixed inset-0 z-50"
        (click)="dismissed.emit()"
        (keydown.escape)="dismissed.emit()"
      >
        <!--
          Click here only stops the backdrop click from bubbling. Focus
          management is handled explicitly (first menuitem is focused on
          open, see the constructor effect), not via this container.
        -->
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div
          #panel
          class="absolute bg-surface-200 border border-surface-100 rounded-card shadow-lift py-1 min-w-[160px]"
          [style.top.px]="y()"
          [style.left.px]="x()"
          role="menu"
          [attr.aria-label]="ariaLabel() || null"
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
export class AppContextMenuComponent {
  readonly open = input<boolean>(false);
  readonly x = input<number>(0);
  readonly y = input<number>(0);
  readonly ariaLabel = input<string>('');

  readonly dismissed = output<void>();

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  readonly firstMenuItem = computed(() => {
    const panel = this.panelRef()?.nativeElement;
    return panel?.querySelector<HTMLElement>('[role="menuitem"]') ?? null;
  });

  constructor() {
    // Move focus onto the first menu item whenever the menu opens, so
    // keyboard/screen-reader users land inside it instead of it silently
    // appearing with focus left wherever it was.
    effect(() => {
      if (this.open()) {
        queueMicrotask(() => this.firstMenuItem()?.focus());
      }
    });
  }
}
