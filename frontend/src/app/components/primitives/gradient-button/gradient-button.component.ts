import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-gradient-button',
  template: `
    <button
      [disabled]="disabled()"
      [class]="buttonClasses()"
      [attr.aria-label]="ariaLabel() || null"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppGradientButtonComponent {
  readonly size = input<'sm' | 'md' | 'icon'>('md');
  readonly disabled = input<boolean>(false);
  readonly customClass = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly clicked = output<MouseEvent>();

  readonly buttonClasses = computed(() => {
    // Deliberately stays pill-shaped (unlike the app/12px radius the rest of
    // the button family uses) - the shape itself signals "this is a
    // VIP/gift CTA", not just the gold gradient.
    const base =
      'inline-flex items-center justify-center font-bold rounded-pill transition-all duration-base ease-app focus:outline-none focus:ring-2 focus:ring-vip focus:ring-offset-2 focus:ring-offset-surface-500';

    let sizeClass = '';
    switch (this.size()) {
      case 'sm':
        sizeClass = 'px-3 py-1.5 text-xs';
        break;
      case 'md':
        sizeClass = 'px-6 py-2.5 text-sm';
        break;
      case 'icon':
        sizeClass = 'w-10 h-10';
        break;
    }

    const stateClass = this.disabled()
      ? 'bg-surface-300 text-text-muted cursor-not-allowed opacity-50'
      : 'bg-gradient-to-r from-vip to-accent text-on-fill hover:opacity-90 shadow-lift';

    const extra = this.customClass();
    return `${base} ${sizeClass} ${stateClass} ${extra}`.trim();
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
