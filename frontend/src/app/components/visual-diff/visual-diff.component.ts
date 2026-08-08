import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
  index: number;
}

@Component({
  selector: 'app-visual-diff',
  styles: `
    :host {
      display: block;
    }
  `,
  template: `
    <div class="bg-amber-500/10 border border-amber-500/30 rounded-card p-4 shadow-sm my-2">
      <div class="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-3">
        <span
          class="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5"
        >
          <span>&#10024;&#65039; {{ titleLabel() }}</span>
        </span>
        <span class="text-[11px] font-medium text-text-secondary">{{ subtitleLabel() }}</span>
      </div>

      <div class="text-sm md:text-base leading-relaxed break-words font-medium">
        @for (seg of segments(); track seg.text + '-' + seg.type) {
          <span>
            @if (seg.type === 'unchanged') {
              <span class="text-text-primary">{{ seg.text }}</span>
            }
            @if (seg.type === 'removed') {
              <span
                class="line-through text-red-600 bg-red-500/20 ps-1 pe-1 py-0.5 rounded ms-0.5 me-0.5 select-none"
                data-type="removed"
              >{{ seg.text }}</span
              >
            }
            @if (seg.type === 'added') {
              <span
                class="text-emerald-400 bg-emerald-500/20 font-bold ps-1 pe-1 py-0.5 rounded ms-0.5 me-0.5 shadow-sm"
                data-type="added"
              >{{ seg.text }}</span
              >
            }
          </span>
        }
      </div>

      @if (explanation()) {
        <div
          class="mt-3 pt-3 border-t border-amber-500/30 text-xs text-text-secondary bg-surface-200/70 p-2.5 rounded-app"
        >
          <span class="font-bold text-amber-400 block mb-0.5">&#128161; {{ tutorLabel() }}:</span>
          {{ explanation() }}
        </div>
      }
    </div>
  `,
})
export class VisualDiffComponent {
  private i18n = inject(I18nService);

  readonly original = input<string>('');
  readonly corrected = input<string>('');
  readonly explanation = input<string>();

  /** I18n labels - computed signals using TranslatePipe-equivalent I18nService. */
  readonly titleLabel = computed(() => this.i18n.translate('visualDiff.title'));
  readonly subtitleLabel = computed(() => this.i18n.translate('visualDiff.subtitle'));
  readonly tutorLabel = computed(() => this.i18n.translate('visualDiff.tutorExplanation'));

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