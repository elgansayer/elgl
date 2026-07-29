import { Component, input, output, inject, signal, effect } from '@angular/core';

import { VocabularyStore } from '../../services/vocabulary.store';

export interface TokenSegment {
  segment: string;
  isWordLike: boolean;
  index: number;
}

@Component({
  selector: 'app-tokenised-text',
  imports: [],
  templateUrl: './tokenised-text.component.html',
  styleUrls: ['./tokenised-text.component.scss'],
})
export class TokenisedTextComponent {
  readonly vocabStore = inject(VocabularyStore);

  text = input.required<string>();
  language = input('en');
  wordClicked = output<{ token: string; context: string }>();

  readonly tokens = signal<TokenSegment[]>([]);

  constructor() {
    effect(() => {
      this.text();
      this.language();
      this.parseText();
    });
  }

  private parseText(): void {
    const segments: TokenSegment[] = [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(this.language(), { granularity: 'word' });
      const rawSegments = segmenter.segment(this.text());
      for (const item of rawSegments) {
        segments.push({
          segment: item.segment,
          isWordLike: item.isWordLike ?? /\w/.test(item.segment),
          index: item.index,
        });
      }
    } else {
      // Emergency fallback if browser environment lacks Intl.Segmenter (though Rule 3 notes baseline 2024 support)
      const parts = this.text().split(/(\s+|[.,!?;:"'()]+)/);
      parts.forEach((part: string, idx: number) => {
        if (part) {
          segments.push({
            segment: part,
            isWordLike: /^\w+$/.test(part),
            index: idx,
          });
        }
      });
    }
    this.tokens.set(segments);
  }

  onTokenClick(token: TokenSegment): void {
    if (!token.isWordLike) return;
    this.wordClicked.emit({
      token: token.segment,
      context: this.text(),
    });
  }
}
