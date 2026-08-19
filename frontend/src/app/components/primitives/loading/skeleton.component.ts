import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonShape = 'text' | 'circle' | 'rectangle';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    class: 'relay-skeleton-group',
  },
  template: `
    @for (item of items(); track item) {
      <span
        class="relay-skeleton"
        [class.relay-skeleton--text]="shape() === 'text'"
        [class.relay-skeleton--circle]="shape() === 'circle'"
        [class.relay-skeleton--rectangle]="shape() === 'rectangle'"
        [style.inline-size]="width()"
        [style.block-size]="height()"
      ></span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2, 0.5rem);
      min-inline-size: 0;
    }

    .relay-skeleton {
      display: block;
      max-inline-size: 100%;
      min-block-size: 0.75rem;
      border-radius: var(--radius-md, 0.5rem);
      background: linear-gradient(
        100deg,
        var(--surface-muted, color-mix(in srgb, currentColor 8%, transparent)) 20%,
        var(--surface-elevated, color-mix(in srgb, currentColor 14%, transparent)) 40%,
        var(--surface-muted, color-mix(in srgb, currentColor 8%, transparent)) 60%
      );
      background-size: 220% 100%;
      animation: relay-skeleton-shimmer var(--motion-duration-deliberate, 1.4s)
        linear infinite;
    }

    .relay-skeleton--text {
      border-radius: var(--radius-sm, 0.25rem);
    }

    .relay-skeleton--circle {
      aspect-ratio: 1;
      border-radius: 999px;
    }

    .relay-skeleton--rectangle {
      border-radius: var(--radius-lg, 0.75rem);
    }

    @keyframes relay-skeleton-shimmer {
      from {
        background-position-x: 100%;
      }
      to {
        background-position-x: -100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .relay-skeleton {
        animation: none;
        background: var(
          --surface-muted,
          color-mix(in srgb, currentColor 10%, transparent)
        );
      }
    }

    @media (forced-colors: active) {
      .relay-skeleton {
        border: 1px solid CanvasText;
        background: Canvas;
      }
    }
  `,
})
export class RelaySkeletonComponent {
  readonly count = input(1, {
    transform: (value: number | string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed)
        ? Math.min(Math.max(Math.trunc(parsed), 1), 20)
        : 1;
    },
  });
  readonly shape = input<SkeletonShape>('text');
  readonly width = input('100%');
  readonly height = input('1rem');

  readonly items = computed(() =>
    Array.from({ length: this.count() }, (_, index) => index),
  );
}
