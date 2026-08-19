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
            <span class="bg-success/15 text-success rounded ps-0.5 pe-0.5" data-type="added">
              {{ segment.text }}
            </span>
          }
          @case ('removed') {
            <span
              class="bg-danger/15 text-danger line-through rounded ps-0.5 pe-0.5"
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

  private flashcardService = inject(FlashcardService);
  private i18n = inject(I18nService);
  private chatService = inject(ChatService);
  private translationCache = inject(TranslationCacheService);

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
      await this.flashcardService.createFlashcard({
        word_token: this.corrected(),
        translation: this.original(),
        original_context: this.explanation() || undefined,
      });
      showToast(this.i18n.translate('correction.flashcardCreatedAlert') || 'Flashcard created');
    } catch (err) {
      console.error('Error creating flashcard', err);
      showToast(this.i18n.translate('error.general') || 'Error');
    }
  }

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
