import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-gradient-button',
  imports: [...HlmButtonImports],
  template: `
    <button
      hlmBtn
      variant="ghost"
      [size]="helmSize()"
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

  readonly helmSize = computed(() => {
    if (this.size() === 'icon') return 'icon-touch' as const;
    return this.size() === 'md' ? ('touch' as const) : ('sm' as const);
  });

  readonly buttonClasses = computed(() => {
    const product = this.disabled()
      ? 'rounded-pill bg-surface-300 text-text-muted opacity-50'
      : 'rounded-pill bg-gradient-to-r from-vip to-accent text-on-fill hover:opacity-90 shadow-lift';
    return `${product}${this.customClass() ? ` ${this.customClass()}` : ''}`;
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) this.clicked.emit(event);
  }
}
