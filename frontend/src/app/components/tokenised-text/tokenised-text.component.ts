import { Component, input, output, inject, computed } from '@angular/core';

import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';

export interface TokenSegment {
  segment: string;
  isWordLike: boolean;
  index: number;
}

interface ParsedTokens {
  tokens: TokenSegment[];
  transliteration: string;
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
  readonly transliterationService = inject(TransliterationService);

  text = input.required<string>();
  language = input('en');
  wordClicked = output<{ token: string; context: string }>();

  private readonly parsed = computed<ParsedTokens>(() => {
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

    return {
      tokens: segments,
      transliteration: this.transliterationService.transliterate(this.text(), this.language()),
    };
  });

  readonly tokens = computed(() => this.parsed().tokens);
  readonly transliteration = computed(() => this.parsed().transliteration);

  onTokenClick(token: TokenSegment): void {
    if (!token.isWordLike) return;
    this.wordClicked.emit({
      token: token.segment,
      context: this.text(),
    });
  }
}
