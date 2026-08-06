import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  template: ``,
  host: {
    '[style.height]': 'height()',
    '[style.width]': 'width()',
    '[style.borderRadius]': 'borderRadius()',
    '[class]': 'hostClasses()',
    '[attr.aria-hidden]': 'true',
    '[attr.role]': '"presentation"',
  },
})
export class AppSkeletonLoaderComponent {
  readonly height = input<string>('16px');
  readonly width = input<string>('100%');
  readonly borderRadius = input<string>('8px');
  readonly variant = input<'text' | 'circle' | 'rect'>('rect');
  readonly customClass = input<string>('');

  readonly hostClasses = computed(() => {
    const base = 'block animate-pulse bg-surface-100';
    let shape = '';

    switch (this.variant()) {
      case 'circle':
        shape = 'rounded-full';
        break;
      case 'text':
        shape = 'rounded';
        break;
      default:
        shape = '';
        break;
    }

    const extra = this.customClass();
    return `${base} ${shape}${extra ? ' ' + extra : ''}`.trim();
  });
}