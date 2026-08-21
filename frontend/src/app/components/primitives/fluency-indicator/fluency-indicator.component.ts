import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';

import { getLanguageFlag } from '../language-picker/language-picker.component';

@Component({
  selector: 'app-fluency-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div
      class="flex items-center gap-1.5 text-xs font-bold text-text-primary"
      role="img"
      [attr.aria-label]="fluencyLabel()"
    >
      <div class="flex items-center gap-1">
        <!-- Render native languages -->
        @for (lang of nativeLanguages(); track lang.code; let last = $last) {
          <span class="flex items-center gap-0.5">
            <span class="text-[10px]" aria-hidden="true">{{ getFlag(lang.code) }}</span>
            <span class="uppercase">{{ lang.code }}</span>
          </span>
          @if (!last) {
            <span class="text-text-muted" aria-hidden="true">|</span>
          }
        }
      </div>

      <span class="text-text-muted mx-0.5" aria-hidden="true">⇌</span>

      <div class="flex items-center gap-1">
        <!-- Render target languages -->
        @for (lang of targetLanguages(); track lang.code; let last = $last) {
          <span class="flex items-center gap-0.5">
            <span class="text-[10px]" aria-hidden="true">{{ getFlag(lang.code) }}</span>
            <span class="uppercase text-neon-violet">{{ lang.code }}</span>
          </span>
          @if (!last) {
            <span class="text-text-muted" aria-hidden="true">|</span>
          }
        }
      </div>
    </div>
  `,
})
export class FluencyIndicatorComponent {
  nativeLanguages = input.required<{ code: string; level?: number }[]>();
  targetLanguages = input.required<{ code: string; level?: number }[]>();

  readonly fluencyLabel = computed(() => {
    const native = this.nativeLanguages()
      .map((l) => l.code)
      .join(', ');
    const target = this.targetLanguages()
      .map((l) => l.code)
      .join(', ');
    return `Speaks ${native}; learning ${target}`;
  });

  getFlag(code: string): string {
    return getLanguageFlag(code);
  }
}
