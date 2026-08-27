import { Component, computed, input, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';
import { ChatService } from '../../services/chat.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLanguages } from '@ng-icons/lucide';

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
  index: number;
}

@Component({
  selector: 'app-visual-diff',
  imports: [...HlmButtonImports, TranslatePipe, NgIcon],
  providers: [provideIcons({ lucideLanguages })],
  template: `
    <div class="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
      @for (segment of segments(); track segment.index) {
        @switch (segment.type) {
          @case ('added') {
            <ins
              class="bg-success/15 text-success rounded ps-0.5 pe-0.5 no-underline"
              data-type="added"
            >
              {{ segment.text }}
            </ins>
          }
          @case ('removed') {
            <del
              class="bg-danger/15 text-danger line-through rounded ps-0.5 pe-0.5"
              data-type="removed"
            >
              {{ segment.text }}
            </del>
          }
          @default {
            <span data-type="unchanged">{{ segment.text }}</span>
          }
        }
      }
    </div>
    @if (explanation()) {
      <div class="mt-1 text-xs text-text-secondary italic group flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span>{{ explanation() }}</span>
          @if (showActions()) {
            <button
              hlmBtn
              variant="ghost"
              size="icon-sm"
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              (click)="translateExplanation()"
              [disabled]="isTranslating()"
              [attr.aria-label]="'moments.translate' | t"
            >
              <ng-icon name="lucideLanguages" class="text-text-secondary" />
            </button>
          }
        </div>
        @if (translatedExplanation()) {
          <div class="text-text-primary bg-surface-200 p-2 rounded border border-surface-100">
            {{ translatedExplanation() }}
          </div>
        }
      </div>
    }
    @if (showActions()) {
      <div class="mt-2 flex gap-2">
        <button hlmBtn variant="outline" size="sm" class="text-xs" (click)="createFlashcard()">
          ➕ {{ 'correction.createFlashcard' | t }}
        </button>
      </div>
    }
  `,
})
export class VisualDiffComponent {
  readonly original = input.required<string>();
  readonly corrected = input.required<string>();
  readonly explanation = input<string>();
  readonly showActions = input<boolean>(false);

  private readonly flashcardService = inject(FlashcardService);
  private readonly i18n = inject(I18nService);
  private readonly chatService = inject(ChatService);
  private readonly translationCache = inject(TranslationCacheService);
  private readonly wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

  readonly isTranslating = signal(false);
  readonly translatedExplanation = signal<string | null>(null);

  async translateExplanation() {
    const text = this.explanation();
    if (!text) return;

    // Toggle off if already showing
    if (this.translatedExplanation()) {
      this.translatedExplanation.set(null);
      return;
    }

    const targetLang = this.i18n.currentLang();
    const cached = this.translationCache.get(text, targetLang);
    if (cached) {
      this.translatedExplanation.set(cached);
      return;
    }

    this.isTranslating.set(true);
    try {
      const res = await this.chatService.translateText(text, targetLang);
      if (res.translated_text) {
        this.translationCache.set(text, targetLang, res.translated_text);
        this.translatedExplanation.set(res.translated_text);
      }
    } catch (err) {
      console.error('Translation error', err);
      showToast(this.i18n.translate('moments.translationError') || 'Translation failed');
    } finally {
      this.isTranslating.set(false);
    }
  }

  async createFlashcard() {
    try {
      const wordToken = this.corrected().substring(0, 200);
      const translation = this.original().substring(0, 500);
      const originalContext = this.explanation() ? this.explanation()!.substring(0, 1000) : undefined;

      await this.flashcardService.createFlashcard({
        word_token: wordToken,
        translation: translation,
        original_context: originalContext,
      });
      showToast(this.i18n.translate('correction.flashcardCreatedAlert') || 'Flashcard created');
    } catch (err) {
      console.error('Error creating flashcard', err);
      showToast(this.i18n.translate('error.general') || 'Error');
    }
  }

  readonly segments = computed<DiffSegment[]>(() => {
    const originalTokens = this.tokenise(this.original());
    const correctedTokens = this.tokenise(this.corrected());
    const lcs = this.buildLcsMatrix(originalTokens, correctedTokens);
    const result: DiffSegment[] = [];
    let originalIndex = 0;
    let correctedIndex = 0;
    let segmentIndex = 0;

    while (originalIndex < originalTokens.length && correctedIndex < correctedTokens.length) {
      const originalToken = originalTokens[originalIndex];
      const correctedToken = correctedTokens[correctedIndex];

      if (this.tokensEqual(originalToken, correctedToken)) {
        result.push({ type: 'unchanged', text: correctedToken, index: segmentIndex++ });
        originalIndex++;
        correctedIndex++;
        continue;
      }

      if (lcs[originalIndex + 1][correctedIndex] >= lcs[originalIndex][correctedIndex + 1]) {
        result.push({ type: 'removed', text: originalToken, index: segmentIndex++ });
        originalIndex++;
      } else {
        result.push({ type: 'added', text: correctedToken, index: segmentIndex++ });
        correctedIndex++;
      }
    }

    while (originalIndex < originalTokens.length) {
      result.push({
        type: 'removed',
        text: originalTokens[originalIndex++],
        index: segmentIndex++,
      });
    }

    while (correctedIndex < correctedTokens.length) {
      result.push({
        type: 'added',
        text: correctedTokens[correctedIndex++],
        index: segmentIndex++,
      });
    }

    return result;
  });

  private tokenise(text: string): string[] {
    return Array.from(this.wordSegmenter.segment(text), ({ segment }) => segment);
  }

  private tokensEqual(left: string, right: string): boolean {
    return left.toLowerCase() === right.toLowerCase();
  }

  private buildLcsMatrix(originalTokens: string[], correctedTokens: string[]): Uint32Array[] {
    const matrix = Array.from(
      { length: originalTokens.length + 1 },
      () => new Uint32Array(correctedTokens.length + 1),
    );

    for (let i = originalTokens.length - 1; i >= 0; i--) {
      for (let j = correctedTokens.length - 1; j >= 0; j--) {
        matrix[i][j] = this.tokensEqual(originalTokens[i], correctedTokens[j])
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }

    return matrix;
  }
}
