import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-card',
  template: `<ng-content />`,
  host: {
    '[class]': 'hostClasses()',
    '[attr.role]': 'roleAttribute()',
    '[attr.tabindex]': 'tabindexAttribute()',
  },
})
export class AppCardComponent {
  readonly padding = input<'none' | 'sm' | 'md' | 'lg'>('md');
  readonly variant = input<'default' | 'elevated' | 'outlined' | 'interactive'>('default');
  readonly customClass = input<string>('');

  readonly roleAttribute = computed(() => {
    return this.variant() === 'interactive' ? 'button' : 'region';
  });

  readonly tabindexAttribute = computed(() => {
    return this.variant() === 'interactive' ? '0' : null;
  });

  readonly hostClasses = computed(() => {
    const base = 'block rounded-2xl bg-surface-200 transition-all';

    let paddingClass = '';
    switch (this.padding()) {
      case 'none':
        paddingClass = 'p-0';
        break;
      case 'sm':
        paddingClass = 'ps-3 pe-3 pt-3 pb-3';
        break;
      case 'md':
        paddingClass = 'ps-4 pe-4 pt-4 pb-4';
        break;
      case 'lg':
        paddingClass = 'ps-6 pe-6 pt-6 pb-6';
        break;
    }

    let variantClass = '';
    switch (this.variant()) {
      case 'default':
        variantClass = 'border border-surface-100 shadow-sm';
        break;
      case 'elevated':
        variantClass = 'border border-surface-100 shadow-lg';
        break;
      case 'outlined':
        variantClass = 'border-2 border-surface-100 shadow-none';
        break;
      case 'interactive':
        variantClass =
          'border border-surface-100 shadow-sm cursor-pointer hover:shadow-md hover:border-surface-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2';
        break;
    }

    const extra = this.customClass();
    return `${base} ${paddingClass} ${variantClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
