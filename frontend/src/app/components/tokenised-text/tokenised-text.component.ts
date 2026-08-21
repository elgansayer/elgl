import { Component, ErrorHandler, computed, inject, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';

import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { TransliterationService } from '../../services/transliteration.service';
import {
  FlashcardContextMenuDirective,
  type FlashcardSelectionRequest,
} from '../../services/flashcard-context-menu.directive';
import { FlashcardService } from '../../services/flashcard.service';
import { ChatService } from '../../services/chat.service';
import { showErrorToast, showToast } from '../../services/toast.service';

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
  imports: [FlashcardContextMenuDirective, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <div
      appFlashcardContextMenu
      [sourceLanguage]="language()"
      [selectionContext]="text()"
      (flashcardSelection)="openFlashcardSelection($event)"
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

    <hlm-dialog
      [state]="flashcardDialogState()"
      (stateChanged)="onFlashcardDialogStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-sm bg-surface-200 rounded-sheet shadow-lift border border-surface-100 p-5"
      >
        <hlm-dialog-header>
          <h2 hlmDialogTitle>{{ i18n.translate('common.save') }}</h2>
          @if (flashcardSelection(); as selection) {
            <p hlmDialogDescription class="break-words text-text-secondary">
              {{ selection.text }}
            </p>
          }
        </hlm-dialog-header>

        @if (flashcardError()) {
          <p role="alert" class="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {{ i18n.translate('common.error_generic') }}
          </p>
        }

        <hlm-dialog-footer class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            [disabled]="flashcardCreating()"
            (click)="closeFlashcardSelection()"
          >
            {{ i18n.translate('common.cancel') }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            [disabled]="flashcardCreating()"
            [attr.aria-busy]="flashcardCreating() ? 'true' : null"
            [attr.aria-label]="flashcardActionLabel()"
            (click)="createSelectionFlashcard()"
          >
            {{
              flashcardCreating()
                ? i18n.translate('common.saving')
                : i18n.translate('common.save')
            }}
          </button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
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
  private readonly flashcardService = inject(FlashcardService);
  private readonly chatService = inject(ChatService);
  private readonly errorHandler = inject(ErrorHandler);

  text = input<string>('');
  language = input('en');
  wordClicked = output<{ token: string; context: string }>();

  readonly flashcardSelection = signal<FlashcardSelectionRequest | null>(null);
  readonly flashcardCreating = signal(false);
  readonly flashcardError = signal(false);
  readonly flashcardDialogState = computed<HlmDialogState>(() =>
    this.flashcardSelection() ? 'open' : 'closed',
  );
  readonly flashcardTargetLanguage = computed(
    () => this.i18n.currentLang().split('-')[0] || 'en',
  );
  readonly flashcardActionLabel = computed(() => {
    const selection = this.flashcardSelection();
    const save = this.i18n.translate('common.save');
    return selection ? `${save}: ${selection.text}` : save;
  });

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

  openFlashcardSelection(selection: FlashcardSelectionRequest): void {
    if (!selection.text.trim()) return;
    this.flashcardError.set(false);
    this.flashcardSelection.set(selection);
  }

  closeFlashcardSelection(): void {
    if (this.flashcardCreating()) return;
    this.flashcardError.set(false);
    this.flashcardSelection.set(null);
  }

  onFlashcardDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.closeFlashcardSelection();
  }

  async createSelectionFlashcard(): Promise<void> {
    const selection = this.flashcardSelection();
    if (!selection || this.flashcardCreating()) return;

    this.flashcardCreating.set(true);
    this.flashcardError.set(false);
    try {
      const translated = await this.chatService.translateText(
        selection.text,
        this.flashcardTargetLanguage(),
      );
      const translation = translated.translated_text?.trim();
      if (!translation) throw new Error('Translation provider returned an empty result');

      await this.flashcardService.createFlashcard({
        word_token: selection.text,
        original_context: selection.context,
        translation,
      });
      showToast(
        this.i18n.translate('chatRoom.savedLingqAlert', {
          text: selection.text,
        }),
        'success',
      );
      this.flashcardSelection.set(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const selectionError = new Error(
        `[SRS:TokenisedText] createSelectionFlashcard failed: ${message}`,
      );
      if (error instanceof Error && error.stack) selectionError.stack = error.stack;
      this.errorHandler.handleError(selectionError);
      this.flashcardError.set(true);
      showErrorToast(this.i18n.translate('common.error_generic'));
    } finally {
      this.flashcardCreating.set(false);
    }
  }
}
