import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

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
    // Was previously fetched via I18nService.translate('card.base_classes') -
    // a CSS class string smuggled into the translation dictionary, and out
    // of sync with the equivalent .app-card SCSS utility class. Shared cards
    // now converge on Relay's radius, surface and elevation roles.
    const base = 'block rounded-card bg-surface-200 transition-all';

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
        variantClass = 'border border-surface-100 shadow-card';
        break;
      case 'elevated':
        variantClass = 'border border-surface-100 shadow-lift';
        break;
      case 'outlined':
        variantClass = 'border-2 border-surface-100 shadow-none';
        break;
      case 'interactive':
        variantClass =
          'border border-surface-100 shadow-card cursor-pointer hover:shadow-lift hover:border-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
        break;
    }

    const extra = this.customClass();
    return `${base} ${paddingClass} ${variantClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
