import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LoadingIndicatorComponent } from './loading-indicator.component';

export type LoadingStateKind =
  | 'loading'
  | 'refreshing'
  | 'stale'
  | 'empty'
  | 'processing'
  | 'unavailable'
  | 'error';

@Component({
  selector: 'app-loading-state-panel',
  standalone: true,
  imports: [LoadingIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relay-state-panel',
    '[class.relay-state-panel--inline]': 'inline()',
    '[attr.role]': 'role()',
    '[attr.aria-live]': 'liveMode()',
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
  template: `
    @if (busy()) {
      <app-loading-indicator
        [label]="title()"
        [showLabel]="false"
      />
    }

    <div class="relay-state-panel__content">
      <h2 class="relay-state-panel__title">{{ title() }}</h2>
      @if (description()) {
        <p class="relay-state-panel__description">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3, 0.75rem);
      inline-size: 100%;
      min-inline-size: 0;
      padding: var(--space-5, 1.25rem);
      border: 1px solid var(--border-muted, currentColor);
      border-radius: var(--radius-lg, 0.75rem);
      background: var(--surface-elevated, Canvas);
      color: var(--text-primary, CanvasText);
    }

    :host(.relay-state-panel--inline) {
      display: inline-flex;
      inline-size: auto;
      padding: var(--space-3, 0.75rem);
    }

    .relay-state-panel__content {
      display: grid;
      gap: var(--space-2, 0.5rem);
      min-inline-size: 0;
    }

    .relay-state-panel__title,
    .relay-state-panel__description {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .relay-state-panel__title {
      font: inherit;
      font-weight: 650;
    }

    .relay-state-panel__description {
      color: var(--text-secondary, currentColor);
    }

    @media (forced-colors: active) {
      :host {
        border-color: CanvasText;
        background: Canvas;
        color: CanvasText;
      }
    }
  `,
})
export class LoadingStatePanelComponent {
  readonly state = input.required<LoadingStateKind>();
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly inline = input(false);

  readonly busy = computed(() =>
    ['loading', 'refreshing', 'processing'].includes(this.state()),
  );
  readonly role = computed(() =>
    ['error', 'unavailable'].includes(this.state()) ? 'alert' : 'status',
  );
  readonly liveMode = computed(() =>
    ['error', 'unavailable'].includes(this.state()) ? 'assertive' : 'polite',
  );
}
