import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PillColour =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'vip';

// Was previously looked up via I18nService.translate('pill.colour_' + colour)
// against hardcoded Tailwind classes smuggled into the translation
// dictionary, unrelated to the design token palette. Now driven directly by
// the Relay tokens so pill colours stay in sync with the rest of the system
// (and dark-mode fills automatically pair with on-fill for correct contrast).
const PILL_COLOUR_CLASSES: Record<PillColour, string> = {
  primary: 'bg-primary text-on-fill hover:bg-primary/90',
  success: 'bg-success text-on-fill hover:bg-success/90',
  warning: 'bg-warning text-on-fill hover:bg-warning/90',
  danger: 'bg-danger text-on-fill hover:bg-danger/90',
  info: 'bg-secondary text-on-fill hover:bg-secondary/90',
  neutral: 'bg-surface-100 text-text-primary hover:bg-surface-50',
  vip: 'bg-vip text-on-fill hover:bg-vip/90',
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
    '[class]': "'inline-block max-w-full min-w-0'",
  },
})
export class AppPillComponent {
  readonly label = input<string>('');
  readonly colour = input<PillColour>('neutral');
  readonly size = input<'sm' | 'md'>('md');
  readonly customClass = input<string>('');

  readonly pillClasses = computed(() => {
    const base =
      'inline-flex max-w-full min-w-0 items-center justify-center whitespace-normal break-words text-center font-extrabold rounded-pill';

    const sizeClass =
      this.size() === 'sm' ? 'ps-2 pe-2 py-0.5 text-xs' : 'ps-3 pe-3 py-1 text-sm';

    const extra = this.customClass();
    const colourClass = PILL_COLOUR_CLASSES[this.colour()];
    return `${base} ${sizeClass} ${colourClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
