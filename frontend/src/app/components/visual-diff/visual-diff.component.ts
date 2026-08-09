import { Component, computed, input } from '@angular/core';

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
  index: number;
}

@Component({
  selector: 'app-visual-diff',
  template: `
    <div class="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
      @for (segment of segments(); track segment.index) {
        @switch (segment.type) {
          @case ('added') {
            <span
              class="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200 rounded ps-0.5 pe-0.5"
              data-type="added"
            >
              {{ segment.text }}
            </span>
          }
          @case ('removed') {
            <span
              class="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200 line-through rounded ps-0.5 pe-0.5"
              data-type="removed"
            >
              {{ segment.text }}
            </span>
          }
          @default {
            <span data-type="unchanged">{{ segment.text }}</span>
          }
        }
      }
    </div>
  `,
})
export class VisualDiffComponent {
  readonly original = input.required<string>();
  readonly corrected = input.required<string>();
  readonly explanation = input<string>();

  readonly segments = computed<DiffSegment[]>(() => {
    const orig = this.original();
    const corr = this.corrected();

    // Universal tokenisation: use the native Intl.Segmenter (word granularity) per Rule 3.
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const origTokens = Array.from(segmenter.segment(orig)).map((s) => s.segment);
    const corrTokens = Array.from(segmenter.segment(corr)).map((s) => s.segment);

    const result: DiffSegment[] = [];
    let i = 0;
    let j = 0;
    let indexCounter = 0;

    while (i < origTokens.length || j < corrTokens.length) {
      if (
        i < origTokens.length &&
        j < corrTokens.length &&
        origTokens[i].toLowerCase() === corrTokens[j].toLowerCase()
      ) {
        result.push({ type: 'unchanged', text: corrTokens[j], index: indexCounter++ });
        i++;
        j++;
      } else if (
        i < origTokens.length &&
        !corrTokens.slice(j, j + 5).some((t) => t.toLowerCase() === origTokens[i].toLowerCase())
      ) {
        result.push({ type: 'removed', text: origTokens[i], index: indexCounter++ });
        i++;
      } else if (j < corrTokens.length) {
        result.push({ type: 'added', text: corrTokens[j], index: indexCounter++ });
        j++;
      } else if (i < origTokens.length) {
        result.push({ type: 'removed', text: origTokens[i], index: indexCounter++ });
        i++;
      }
    }

    return result;
  });
}
