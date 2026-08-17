import { Component, computed, input, inject, signal } from '@angular/core';
import { VocabularyStore } from '../../services/vocabulary.store';
import { showToast } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';

interface DiffSegment {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
  index: number;
}

@Component({
  selector: 'app-visual-diff',
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
  `,
})
export class VisualDiffComponent {
  readonly vocabStore = inject(VocabularyStore);

  readonly i18n = inject(I18nService);

  readonly showTranslation = signal(false);
  readonly translationText = signal<string | null>(null);
  readonly translating = signal(false);

  async toggleTranslation(): Promise<void> {
    if (this.showTranslation()) {
      this.showTranslation.set(false);
      return;
    }
    if (this.translationText()) {
      this.showTranslation.set(true);
      return;
    }
    if (!this.explanation()) return;

    this.translating.set(true);
    try {
      const result = await this.vocabStore.translateWordOrSentence(this.explanation()!, 'en');
      this.translationText.set(result.translated_text);
      this.showTranslation.set(true);
    } catch {
      showToast('Failed to translate', 'error');
    } finally {
      this.translating.set(false);
    }
  }

  async saveToSrs(): Promise<void> {
    try {
      await this.vocabStore.saveWord({
        word_token: this.corrected(),
        translation: this.explanation() || this.original(),
        original_context: this.corrected(),
      });
      showToast(this.i18n.translate('visual_diff.srsSaved') || 'Saved to SRS', 'success');
    } catch {
      showToast(this.i18n.translate('visual_diff.srsError') || 'Failed to save to SRS', 'error');
    }
  }
  readonly original = input.required<string>();
  readonly corrected = input.required<string>();
  readonly explanation = input<string>();

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
