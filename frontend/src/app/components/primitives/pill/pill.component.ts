import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../services/i18n.service';

const PILL_COLOUR_KEYS: Record<string, string> = {
  primary: 'pill.colour_primary',
  success: 'pill.colour_success',
  warning: 'pill.colour_warning',
  danger: 'pill.colour_danger',
  info: 'pill.colour_info',
  neutral: 'pill.colour_neutral',
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
  private readonly i18n = inject(I18nService);
  readonly label = input<string>('');
  readonly colour = input<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>(
    'neutral',
  );
  readonly size = input<'sm' | 'md'>('md');
  readonly customClass = input<string>('');

  readonly pillClasses = computed(() => {
    const base = 'inline-flex items-center justify-center font-extrabold rounded-full';

    const sizeClass =
      this.size() === 'sm' ? 'ps-2 pe-2 py-0.5 text-xs' : 'ps-3 pe-3 py-1 text-sm';

    const extra = this.customClass();
    const colourClass = this.i18n.translate(PILL_COLOUR_KEYS[this.colour()]);
    return `${base} ${sizeClass} ${colourClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
