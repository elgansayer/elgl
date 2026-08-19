import { Component, input, output, inject, computed } from '@angular/core';

import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';
import { FlashcardContextMenuDirective } from '../../services/flashcard-context-menu.directive';

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
  imports: [FlashcardContextMenuDirective],
  template: `
    <div
      appFlashcardContextMenu
      [sourceLanguage]="language()"
      [targetLanguage]="flashcardTargetLanguage()"
      [selectionContext]="text()"
      class="inline leading-relaxed select-text font-medium text-base"
    >
      @for (token of tokens(); track token.index) {
        <span
          (click)="onTokenClick(token)"
          (keydown.enter)="onTokenClick(token)"
          (keydown.space)="onTokenClick(token); $event.preventDefault()"
          [attr.tabindex]="token.isWordLike ? 0 : null"
          [attr.role]="token.isWordLike ? 'button' : null"
          [class]="
            'transition-colours rounded px-0.5 ' +
            (token.isWordLike ? vocabStore.getWordStatus(token.segment).colourClass : '')
          "
        >
          {{ token.segment }}
        </span>
      }
      @if (transliteration()) {
        <div class="transliteration mt-1 text-xs leading-snug text-text-muted" dir="ltr">
          {{ transliteration() }}
        </div>
      }
    </div>
  `,
  styles: `
    .transliteration {
      margin-block-start: 0.25rem;
      font-size: 0.75rem;
      line-height: 1.25rem;
      color: rgb(var(--text-muted-rgb));
    }
  `,
})
export class TokenisedTextComponent {
  readonly vocabStore = inject(VocabularyStore);
  readonly i18n = inject(I18nService);
  readonly transliterationService = inject(TransliterationService);

  text = input<string>('');
  language = input('en');
  wordClicked = output<{ token: string; context: string }>();

  readonly flashcardTargetLanguage = computed(
    () => this.i18n.currentLang().split('-')[0] || 'en',
  );

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
