import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    class: 'relay-loading-indicator',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <span class="relay-loading-indicator__spinner" aria-hidden="true"></span>
    @if (showLabel()) {
      <span class="relay-loading-indicator__label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 0.5rem);
      min-inline-size: 0;
    }

    .relay-loading-indicator__spinner {
      inline-size: var(--loading-indicator-size, 1.125rem);
      block-size: var(--loading-indicator-size, 1.125rem);
      flex: 0 0 auto;
      border: 0.14em solid
        var(--border-muted, color-mix(in srgb, currentColor 20%, transparent));
      border-block-start-color: currentColor;
      border-radius: 999px;
      animation: relay-loading-spin var(--motion-duration-standard, 0.8s)
        linear infinite;
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
  readonly label = input.required<string>();
  readonly showLabel = input(false);
}
