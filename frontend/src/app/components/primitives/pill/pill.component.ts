import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

// Was previously looked up via I18nService.translate('pill.colour_' + colour)
// against hardcoded Tailwind classes smuggled into the translation
// dictionary, unrelated to the design token palette. Now driven directly by
// the Relay tokens so pill colours stay in sync with the rest of the system
// (and dark-mode fills automatically pair with on-fill for correct contrast).
const PILL_COLOUR_CLASSES: Record<string, string> = {
  primary: 'bg-primary text-on-fill hover:bg-primary/90',
  success: 'bg-success text-on-fill hover:bg-success/90',
  warning: 'bg-warning text-on-fill hover:bg-warning/90',
  danger: 'bg-danger text-on-fill hover:bg-danger/90',
  info: 'bg-secondary text-on-fill hover:bg-secondary/90',
  neutral: 'bg-surface-100 text-text-primary hover:bg-surface-50',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pill',
  template: `
    <span [class]="pillClasses()">
      @if (label()) {
        {{ label() }}
      } @else {
        <ng-content />
      }
    </span>
  `,
  host: {
    '[class]': "'inline-block'",
  },
})
export class AppPillComponent {
  readonly label = input<string>('');
  readonly colour = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>(
    'neutral',
  );
  readonly size = input<'sm' | 'md'>('md');
  readonly customClass = input<string>('');

  readonly pillClasses = computed(() => {
    const base = 'inline-flex items-center justify-center font-extrabold rounded-pill';

    const sizeClass = this.size() === 'sm' ? 'ps-2 pe-2 py-0.5 text-xs' : 'ps-3 pe-3 py-1 text-sm';

    const extra = this.customClass();
    const colourClass = PILL_COLOUR_CLASSES[this.colour()];
    return `${base} ${sizeClass} ${colourClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
