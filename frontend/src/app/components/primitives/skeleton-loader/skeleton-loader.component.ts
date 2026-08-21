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
    '[attr.aria-label]': '"Loading placeholder"',
  },
})
export class AppSkeletonLoaderComponent {
  readonly height = input<string>('16px');
  readonly width = input<string>('100%');
  readonly borderRadius = input<string>('8px');
  readonly variant = input<'text' | 'circle' | 'rect'>('rect');
  readonly customClass = input<string>('');

  readonly hostClasses = computed(() => {
    const base = 'block skeleton-shimmer bg-surface-100';
    const variant = this.variant();
    const shape = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded' : '';
    const extra = this.customClass();
    return [base, shape, extra].filter(Boolean).join(' ').trim();
  });
}
