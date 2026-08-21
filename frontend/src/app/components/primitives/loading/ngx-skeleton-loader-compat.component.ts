import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RelaySkeletonComponent, type SkeletonShape } from './skeleton.component';

/**
 * Temporary source-compatible boundary while feature templates migrate from
 * the former package selector to `app-skeleton`.
 *
 * This component contains no third-party runtime and may be removed once all
 * templates consume the Relay primitive directly.
 */
/* eslint-disable @angular-eslint/component-selector */
@Component({
  selector: 'ngx-skeleton-loader',
  standalone: true,
  imports: [RelaySkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-skeleton [count]="count()" [shape]="shape()" [width]="width()" [height]="height()" />
  `,
})
export class NgxSkeletonLoaderCompatibilityComponent {
  readonly count = input<number | string>(1);
  readonly appearance = input<string>('line');
  readonly theme = input<Record<string, string | number> | null>(null);

  readonly shape = computed<SkeletonShape>(() => {
    const appearance = this.appearance().toLowerCase();
    if (appearance === 'circle') {
      return 'circle';
    }
    if (appearance === 'line' || appearance === 'text') {
      return 'text';
    }
    return 'rectangle';
  });

  readonly width = computed(() => normaliseCssLength(this.theme()?.['width'], '100%'));
  readonly height = computed(() =>
    normaliseCssLength(this.theme()?.['height'], this.shape() === 'circle' ? this.width() : '1rem'),
  );
}

function normaliseCssLength(value: string | number | undefined, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return `${value}px`;
  }
  if (
    typeof value === 'string' &&
    /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|ch))$/.test(value.trim())
  ) {
    return value.trim();
  }
  return fallback;
}
