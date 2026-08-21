import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LoadingIndicatorComponent } from './loading-indicator.component';

export type LoadingStateKind =
  'loading' | 'refreshing' | 'stale' | 'empty' | 'processing' | 'unavailable' | 'error';

@Component({
  selector: 'app-loading-state-panel',
  standalone: true,
  imports: [LoadingIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relay-state-panel rounded-app flex items-start gap-3 w-full p-5 border border-muted bg-surface-elevated text-text-primary min-w-0',
    '[class.relay-state-panel--inline]': 'inline()',
    '[class.p-3]': 'inline()',
    '[class.w-auto]': 'inline()',
    '[class.inline-flex]': 'inline()',
    '[attr.role]': 'role()',
    '[attr.aria-live]': 'liveMode()',
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
  template: `
    @if (busy()) {
      <app-loading-indicator [label]="title()" [showLabel]="false" />
    }

    <div class="relay-state-panel__content grid gap-2 min-w-0">
      <h2 class="relay-state-panel__title m-0 font-semibold break-words">{{ title() }}</h2>
      @if (description()) {
        <p class="relay-state-panel__description m-0 text-text-secondary break-words">
          {{ description() }}
        </p>
      }
      <ng-content />
    </div>
  `,
  styles: `
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
  readonly state = input<LoadingStateKind>('loading');
  readonly title = input<string>('');
  readonly description = input<string | null>(null);
  readonly inline = input(false);

  readonly busy = computed(() => ['loading', 'refreshing', 'processing'].includes(this.state()));
  readonly role = computed(() =>
    ['error', 'unavailable'].includes(this.state()) ? 'alert' : 'status',
  );
  readonly liveMode = computed(() =>
    ['error', 'unavailable'].includes(this.state()) ? 'assertive' : 'polite',
  );
}
