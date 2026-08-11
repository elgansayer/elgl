import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-button-secondary',
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="buttonClasses()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-pressed]="ariaPressed() === null ? null : ariaPressed()"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppButtonSecondaryComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly customClass = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly ariaPressed = input<boolean | null>(null);

  readonly clicked = output<MouseEvent>();

  readonly buttonClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center font-bold rounded-app transition-all duration-base ease-app focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-500';

    let sizeClass = '';
    switch (this.size()) {
      case 'sm':
        sizeClass = 'ps-3 pe-3 pt-1.5 pb-1.5 text-xs';
        break;
      case 'md':
        sizeClass = 'ps-4 pe-4 pt-2.5 pb-2.5 text-sm';
        break;
      case 'lg':
        sizeClass = 'ps-6 pe-6 pt-3.5 pb-3.5 text-base';
        break;
    }

    // Hover now moves to surface-50 (always lighter than surface-100 in both
    // themes), fixing a bug where hover and base resolved to the same shade.
    const stateClass = this.disabled()
      ? 'bg-surface-100 text-text-muted border border-surface-100 cursor-not-allowed shadow-none'
      : 'bg-surface-100 text-text-primary border border-surface-100 hover:bg-surface-50 shadow-none cursor-pointer';

    const extra = this.customClass();
    return `${base} ${sizeClass} ${stateClass}${extra ? ' ' + extra : ''}`.trim();
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
