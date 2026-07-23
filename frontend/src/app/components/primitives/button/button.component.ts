import { Component, input, computed, output } from '@angular/core';

@Component({
  selector: 'app-button',
  template: `
    <button
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [class]="hostClasses()"
      (click)="onClick.emit($event)"
    >
      <ng-content />
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class AppButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly disabled = input(false);
  readonly ariaLabel = input<string>('');
  readonly customClass = input<string>('');

  readonly onClick = output<MouseEvent>();

  readonly hostClasses = computed(() => {
    const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2';

    let sizeClass = '';
    switch (this.size()) {
      case 'sm':
        sizeClass = 'px-3 py-1.5 text-sm';
        break;
      case 'md':
        sizeClass = 'px-4 py-2 text-base';
        break;
      case 'lg':
        sizeClass = 'px-6 py-3 text-lg';
        break;
    }

    let variantClass = '';
    switch (this.variant()) {
      case 'primary':
        variantClass = 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed';
        break;
      case 'secondary':
        variantClass = 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed';
        break;
      case 'outline':
        variantClass = 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed';
        break;
      case 'ghost':
        variantClass = 'text-gray-600 hover:bg-gray-100 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed';
        break;
      case 'danger':
        variantClass = 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed';
        break;
    }

    const extra = this.customClass();
    return `${base} ${sizeClass} ${variantClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
