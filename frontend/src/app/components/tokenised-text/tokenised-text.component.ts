import { Component, input, output, inject, computed, ErrorHandler } from '@angular/core';

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
  error: string | null;
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
  private readonly errorHandler = inject(ErrorHandler);

  text = input.required<string>();
  language = input('en');
  wordClicked = output<{ token: string; context: string }>();

  private readonly parsed = computed<ParsedTokens>(() => {
    try {
      if (typeof Intl === 'undefined' || !Intl.Segmenter) {
        const err = new Error(this.i18n.translate('errors.intlSegmenterUnavailable'));
        err.name = 'LingqTokenisationError';
        this.errorHandler.handleError(err);
        return { tokens: [], transliteration: '', error: this.i18n.translate('errors.intlSegmenterUnavailable') };
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
        error: null,
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      err.name = 'LingqTokenisationError';
      this.errorHandler.handleError(err);
      return { tokens: [], transliteration: '', error: err.message };
    }
  });

  readonly tokens = computed(() => this.parsed().tokens);
  readonly transliteration = computed(() => this.parsed().transliteration);
  readonly parseError = computed(() => this.parsed().error);

  onTokenClick(token: TokenSegment): void {
    if (!token.isWordLike) return;
    this.wordClicked.emit({
      token: token.segment,
      context: this.text(),
    });
  }
}
