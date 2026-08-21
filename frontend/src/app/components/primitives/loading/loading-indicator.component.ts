import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    class: 'relay-loading-indicator inline-flex items-center gap-2 min-w-0',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <span class="relay-loading-indicator__spinner rounded-pill" aria-hidden="true"></span>
    @if (showLabel()) {
      <span class="relay-loading-indicator__label">{{ label() }}</span>
    }
  `,
  styles: `
    .relay-loading-indicator__spinner {
      inline-size: var(--loading-indicator-size, 1.125rem);
      block-size: var(--loading-indicator-size, 1.125rem);
      flex: 0 0 auto;
      border: 0.14em solid var(--border-muted, color-mix(in srgb, currentColor 20%, transparent));
      border-block-start-color: currentColor;
      animation: relay-loading-spin var(--motion-duration-standard, 0.8s) linear infinite;
    }

    .relay-loading-indicator__label {
      overflow-wrap: anywhere;
    }

    @keyframes relay-loading-spin {
      to {
        transform: rotate(1turn);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .relay-loading-indicator__spinner {
        animation: none;
        border-style: dotted;
      }
    }

    @media (forced-colors: active) {
      .relay-loading-indicator__spinner {
        border-color: CanvasText;
        border-block-start-color: Highlight;
      }
    }
  `,
})
export class LoadingIndicatorComponent {
  readonly label = input<string>('');
  readonly showLabel = input(false);
}
