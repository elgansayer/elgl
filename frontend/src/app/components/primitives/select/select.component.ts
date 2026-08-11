import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';

/**
 * Token-styled wrapper around the native <select> element, matching
 * app-input/app-textarea's pattern (label + consistent Relay styling)
 * rather than a fully custom ARIA listbox rebuild. Native <select> already
 * has correct keyboard navigation, screen-reader support, and (crucially)
 * platform-native mobile picker UI for free - AGENTS.md's filter-controls
 * policy explicitly allows "selects" as a compact control, so the actual
 * gap across the ~18 existing call sites is inconsistent/off-token styling
 * and the occasional hardcoded aria-label, not a functional a11y defect.
 * Callers keep writing their own <option>/@for content via projection.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-select',
  imports: [TranslatePipe],
  template: `
    @if (label()) {
      <label [for]="selectId()" class="block font-bold text-xs text-text-primary mb-1">
        {{ label() | t }}
      </label>
    }
    <select
      [id]="selectId()"
      [value]="value()"
      [disabled]="disabled()"
      [class]="selectClasses()"
      [attr.aria-label]="ariaLabel() ? (ariaLabel() | t) : null"
      (change)="onChange($event)"
    >
      <ng-content />
    </select>
  `,
  host: {
    '[class]': "'block w-full'",
  },
})
export class AppSelectComponent {
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly selectId = input<string>('app-select-' + Math.random().toString(36).substring(2, 9));
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();

  readonly selectClasses = computed(() => {
    const base =
      'block w-full rounded-app border ps-3 pe-3 pt-2.5 pb-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary';
    const state = this.disabled()
      ? 'bg-surface-100 text-text-muted border-surface-100 cursor-not-allowed'
      : 'bg-surface-300 border-surface-100 text-text-primary cursor-pointer';
    const extra = this.customClass();
    return `${base} ${state}${extra ? ' ' + extra : ''}`.trim();
  });

  onChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement && !this.disabled()) {
      this.valueChange.emit(target.value);
    }
  }
}
