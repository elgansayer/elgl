import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-button-primary',
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="buttonClasses()"
      (click)="onClick($event)"
    >
      <ng-content />
    </button>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppButtonPrimaryComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly customClass = input<string>('');

  readonly clicked = output<MouseEvent>();

  readonly buttonClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center font-bold rounded-app transition-all duration-base ease-app focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-500';

    let sizeClass = '';
    switch (this.size()) {
      case 'sm':
        sizeClass = 'min-h-10 ps-3 pe-3 pt-1.5 pb-1.5 text-xs';
        break;
      case 'md':
        sizeClass = 'min-h-11 ps-4 pe-4 pt-2.5 pb-2.5 text-sm';
        break;
      case 'lg':
        sizeClass = 'min-h-12 ps-6 pe-6 pt-3.5 pb-3.5 text-base';
        break;
    }

    const stateClass = this.disabled()
      ? 'bg-surface-200 text-text-muted cursor-not-allowed shadow-none'
      : 'bg-primary text-on-fill hover:bg-primary/90 shadow-card hover:shadow-lift cursor-pointer';

    const extra = this.customClass();
    return `${base} ${sizeClass} ${stateClass}${extra ? ' ' + extra : ''}`.trim();
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
