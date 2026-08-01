import { Component, inject, input, computed } from '@angular/core';
import { I18nService } from '../../../services/i18n.service';

@Component({
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
      this.size() === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

    let colourClass = '';
    switch (this.colour()) {
      case 'primary':
        colourClass = this.i18n.translate('pill.colour_primary');
        break;
      case 'success':
        colourClass = this.i18n.translate('pill.colour_success');
        break;
      case 'warning':
        colourClass = this.i18n.translate('pill.colour_warning');
        break;
      case 'danger':
        colourClass = this.i18n.translate('pill.colour_danger');
        break;
      case 'info':
        colourClass = this.i18n.translate('pill.colour_info');
        break;
      case 'neutral':
        colourClass = this.i18n.translate('pill.colour_neutral');
        break;
      default:
        colourClass = this.i18n.translate('pill.colour_neutral');
        break;
    }

    const extra = this.customClass();
    return `${base} ${sizeClass} ${colourClass}${extra ? ' ' + extra : ''}`.trim();
  });
}
