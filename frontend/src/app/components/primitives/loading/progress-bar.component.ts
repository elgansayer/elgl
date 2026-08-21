import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relay-progress',
    role: 'progressbar',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': 'normalisedMax()',
    '[attr.aria-valuenow]': 'normalisedValue()',
    '[attr.aria-valuetext]': 'valueText() || null',
  },
  template: `
    <span class="relay-progress__track rounded-pill" aria-hidden="true">
      <span
        class="relay-progress__value rounded-pill"
        [class.relay-progress__value--indeterminate]="normalisedValue() === null"
        [style.inline-size]="percentage()"
      ></span>
    </span>
  `,
  styles: `
    :host {
      display: block;
      inline-size: 100%;
      min-inline-size: 0;
    }

    .relay-progress__track {
      position: relative;
      display: block;
      inline-size: 100%;
      block-size: 0.5rem;
      overflow: hidden;
      background: var(--surface-muted, color-mix(in srgb, currentColor 12%, transparent));
    }

    .relay-progress__value {
      display: block;
      block-size: 100%;
      background: var(--accent-primary, currentColor);
      transition: inline-size var(--motion-duration-fast, 160ms)
        var(--motion-easing-standard, ease-out);
    }

    .relay-progress__value--indeterminate {
      position: absolute;
      inset-block: 0;
      inline-size: 38%;
      animation: relay-progress-indeterminate var(--motion-duration-deliberate, 1.2s)
        var(--motion-easing-standard, ease-in-out) infinite;
    }

    @keyframes relay-progress-indeterminate {
      0% {
        inset-inline-start: -40%;
      }
      100% {
        inset-inline-start: 102%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .relay-progress__value {
        transition: none;
      }

      .relay-progress__value--indeterminate {
        inset-inline-start: 0;
        inline-size: 35%;
        animation: none;
      }
    }

    @media (forced-colors: active) {
      .relay-progress__track {
        border: 1px solid CanvasText;
        background: Canvas;
      }

      .relay-progress__value {
        background: Highlight;
      }
    }
  `,
})
export class ProgressBarComponent {
  readonly label = input<string>('');
  readonly value = input<number | null>(null);
  readonly max = input(100);
  readonly valueText = input<string | null>(null);

  readonly normalisedMax = computed(() => {
    const max = this.max();
    return Number.isFinite(max) && max > 0 ? max : 100;
  });

  readonly normalisedValue = computed(() => {
    const value = this.value();
    if (value === null || !Number.isFinite(value)) {
      return null;
    }
    return Math.min(Math.max(value, 0), this.normalisedMax());
  });

  readonly percentage = computed(() => {
    const value = this.normalisedValue();
    if (value === null) {
      return null;
    }
    return `${(value / this.normalisedMax()) * 100}%`;
  });
}
