import { Component, input, output, inject, signal, effect } from '@angular/core';

import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

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
  readonly i18n = inject(I18nService);

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
    if (typeof Intl === 'undefined' || !Intl.Segmenter) {
      throw new Error(this.i18n.translate('errors.intlSegmenterUnavailable'));
    }

    const segments: TokenSegment[] = [];
    const segmenter = new Intl.Segmenter(this.language(), { granularity: 'word' });
    const rawSegments = segmenter.segment(this.text());

    for (const item of rawSegments) {
      segments.push({
        segment: item.segment,
        isWordLike: item.isWordLike ?? false,
        index: item.index,
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
