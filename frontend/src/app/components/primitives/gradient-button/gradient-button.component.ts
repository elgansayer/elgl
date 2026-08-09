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
    const base =
      'inline-flex items-center justify-center font-bold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2';

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
      ? 'bg-surface-300 text-text-secondary cursor-not-allowed opacity-50'
      : 'bg-gradient-to-r from-orange-400 to-yellow-400 text-black hover:opacity-90 shadow-lg shadow-orange-500/20';

    const extra = this.customClass();
    return `${base} ${sizeClass} ${stateClass} ${extra}`.trim();
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
