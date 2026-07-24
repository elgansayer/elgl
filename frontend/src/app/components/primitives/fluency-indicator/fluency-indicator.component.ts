import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getLanguageFlag } from '../language-picker/language-picker.component';

@Component({
  selector: 'app-fluency-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-1.5 text-xs font-bold text-text-primary">
      <div class="flex items-center gap-1">
        <!-- Render native languages -->
        @for (lang of nativeLanguages(); track lang.code; let last = $last) {
          <span class="flex items-center gap-0.5">
            <span class="text-[10px]">{{ getFlag(lang.code) }}</span>
            <span class="uppercase">{{ lang.code }}</span>
          </span>
          @if (!last) {
            <span class="text-text-muted">|</span>
          }
        }
      </div>
      
      <span class="text-text-muted mx-0.5">⇌</span>
      
      <div class="flex items-center gap-1">
        <!-- Render target languages -->
        @for (lang of targetLanguages(); track lang.code; let last = $last) {
          <span class="flex items-center gap-0.5">
            <span class="text-[10px]">{{ getFlag(lang.code) }}</span>
            <span class="uppercase text-purple-400">{{ lang.code }}</span>
          </span>
          @if (!last) {
            <span class="text-text-muted">|</span>
          }
        }
      </div>
    </div>
  `
})
export class FluencyIndicatorComponent {
  nativeLanguages = input.required<{code: string, level?: number}[]>();
  targetLanguages = input.required<{code: string, level?: number}[]>();

  getFlag(code: string): string {
    return getLanguageFlag(code);
  }
}
