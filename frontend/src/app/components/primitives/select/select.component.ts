import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';

/**
 * Token-styled wrapper around the native <hlm-native-select> element, matching
 * app-input/app-textarea's pattern (label + consistent Relay styling)
 * rather than a fully custom ARIA listbox rebuild. Native <hlm-native-select> already
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
  imports: [HlmNativeSelect, TranslatePipe],
  template: `
    @if (label()) {
      <label [for]="selectId()" class="mb-1 block text-xs font-bold text-text-primary">
        {{ label() | t }}
      </label>
    }
    <hlm-native-select
      [selectId]="selectId()"
      [value]="value()"
      [disabled]="disabled()"
      [class]="selectClasses()"
      [selectClass]="selectClasses()"
      [aria-label]="ariaLabel() ? (ariaLabel() | t) : null"
      (valueChange)="onValueChange($event)"
    >
      <ng-content />
    </hlm-native-select>
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
  readonly selectId = input<string>('app-select-' + crypto.randomUUID());
  readonly customClass = input<string>('');

  readonly valueChange = output<string>();

  readonly selectClasses = computed(() => {
    const base =
      'block w-full rounded-app border ps-3 pe-3 pt-2.5 pb-2.5 text-sm font-medium transition-colors';
    const state = this.disabled()
      ? 'cursor-not-allowed border-surface-100 bg-surface-100 text-text-muted'
      : 'cursor-pointer border-surface-100 bg-surface-300 text-text-primary';
    const extra = this.customClass();
    return `${base} ${state}${extra ? ' ' + extra : ''}`.trim();
  });

  onValueChange(value: string | undefined | null): void {
    if (!this.disabled() && value != null) {
      this.valueChange.emit(value);
    }
  }
}
