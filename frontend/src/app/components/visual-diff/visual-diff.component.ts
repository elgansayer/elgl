import { Component, computed, input } from '@angular/core';

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

@Component({
  selector: 'app-visual-diff',
  imports: [],
  templateUrl: './visual-diff.component.html',
  styleUrls: ['./visual-diff.component.scss'],
})
export class VisualDiffComponent {
  readonly original = input.required<string>();
  readonly corrected = input.required<string>();
  readonly explanation = input<string>();

  readonly segments = computed<DiffSegment[]>(() => {
    const orig = this.original();
    const corr = this.corrected();

    // Universal tokenisation: use native Intl.Segmenter (word granularity) per Rule 3
    let origTokens: string[];
    let corrTokens: string[];

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
      origTokens = Array.from(segmenter.segment(orig)).map((s) => s.segment);
      corrTokens = Array.from(segmenter.segment(corr)).map((s) => s.segment);
    } else {
      origTokens = orig.split(/(\s+)/);
      corrTokens = corr.split(/(\s+)/);
    }

    // Simple LCS-based or sequential diffing algorithm
    const result: DiffSegment[] = [];
    let i = 0;
    let j = 0;

    while (i < origTokens.length || j < corrTokens.length) {
      if (
        i < origTokens.length &&
        j < corrTokens.length &&
        origTokens[i].toLowerCase() === corrTokens[j].toLowerCase()
      ) {
        result.push({ type: 'unchanged', text: corrTokens[j] });
        i++;
        j++;
      } else if (
        i < origTokens.length &&
        !corrTokens.slice(j, j + 5).some((t) => t.toLowerCase() === origTokens[i].toLowerCase())
      ) {
        result.push({ type: 'removed', text: origTokens[i] });
        i++;
      } else if (j < corrTokens.length) {
        result.push({ type: 'added', text: corrTokens[j] });
        j++;
      } else if (i < origTokens.length) {
        result.push({ type: 'removed', text: origTokens[i] });
        i++;
      }
    }

    return result;
  });
}
