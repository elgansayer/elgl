import { Component, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast, showErrorToast } from '../../services/toast.service';

@Component({
  selector: 'app-vocabulary-display',
  imports: [TranslatePipe],
  template: `
<<<<<<< HEAD
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-200">{{ 'vocabDisplay.title' | t }}</h3>
=======
    <div class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="app-section-title">{{ 'vocabDisplay.title' | t }}</h3>
>>>>>>> origin/main
        <button
          (click)="refreshVocabulary()"
          class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          [disabled]="loading()"
          [attr.aria-label]="'vocabDisplay.refreshAriaLabel' | t"
        >
          @if (loading()) {
<<<<<<< HEAD
            <span class="inline-block animate-spin" aria-hidden="true">⟳</span>
=======
            <span class="inline-block animate-spin" aria-hidden="true">&#8635;</span>
>>>>>>> origin/main
            {{ 'vocabDisplay.loading' | t }}
          } @else {
            {{ 'vocabDisplay.refresh' | t }}
          }
        </button>
      </div>

      @if (vocabularyByTag().size === 0) {
<<<<<<< HEAD
        <div
          class="p-8 text-center text-text-muted bg-surface-800/30 rounded-xl border border-dashed border-slate-700"
          role="status"
        >
          <p class="text-lg mb-2" aria-hidden="true">📚</p>
          <p>{{ 'vocabDisplay.emptyState' | t }}</p>
        </div>
      }

      @for (entry of vocabularyByTagEntries(); track entry[0]) {
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span aria-hidden="true">{{ getTagIcon(entry[0]) }}</span>
            <span>{{ entry[0] }}</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            @for (item of entry[1]; track item.word) {
              <div
                class="flex items-center justify-between p-3 bg-surface-200 rounded-card border border-surface-100 hover:border-surface-200 transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-text-primary">{{ item.word }}</p>
                  <p class="text-xs text-text-muted">{{ item.translation }}</p>
                </div>
                <button
                  (click)="addToFlashcards(item)"
                  class="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                  [attr.aria-label]="'vocabDisplay.addToSrsAriaLabel' | t: { word: item.word }"
                >
                  {{ 'vocabDisplay.addToSrs' | t }}
                </button>
              </div>
            }
          </div>
        </div>
      }
=======
        <div class="app-empty-state" role="status">
          <p class="text-3xl mb-3" aria-hidden="true">&#128218;</p>
          <p class="font-bold text-text-primary">{{ 'vocabDisplay.emptyTitle' | t }}</p>
          <p class="app-muted mt-1">{{ 'vocabDisplay.emptyDesc' | t }}</p>
        </div>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (entry of vocabularyByTagEntries(); track entry[0]) {
          <section class="app-card app-padded space-y-3">
            <h4 class="text-sm font-bold text-text-primary flex items-center gap-2">
              <span aria-hidden="true">{{ getTagIcon(entry[0]) }}</span>
              <span>{{ entry[0] }}</span>
            </h4>
            <div class="space-y-2">
              @for (item of entry[1]; track item.word) {
                <div
                  class="rounded-card flex items-center justify-between border border-surface-100 bg-surface-300 px-3 py-2"
                >
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-text-primary truncate">{{ item.word }}</p>
                    <p class="text-xs text-text-secondary truncate">{{ item.translation }}</p>
                  </div>
                  <button
                    (click)="addToFlashcards(item)"
                    class="rounded-app ms-2 bg-primary ps-2.5 pe-2.5 pt-1 pb-1 text-[11px] font-bold text-white hover:opacity-90 flex-shrink-0"
                    [attr.aria-label]="'vocabDisplay.addToSrsAriaLabel' | t: { word: item.word }"
                  >
                    {{ 'vocabDisplay.addToSrs' | t }}
                  </button>
                </div>
              }
            </div>
          </section>
        }
      </div>
>>>>>>> origin/main
    </div>
  `,
})
export class VocabularyDisplayComponent {
  private readonly store = inject(HobbyTagsStore);
  private readonly flashcardService = inject(FlashcardService);
  private readonly i18n = inject(I18nService);

  readonly loading = computed(() => this.store.loading());
  readonly vocabularyByTag = computed(() => this.store.vocabularyByTag());
  readonly vocabularyByTagEntries = computed(() => Array.from(this.vocabularyByTag().entries()));

  private readonly allTags = computed(() => this.store.allTags());
  private readonly tagIconMap = computed(() => {
    const map = new Map<string, string>();
    for (const tag of this.allTags()) {
      map.set(tag.name, tag.icon);
    }
    return map;
  });

  constructor() {
    this.store.loadVocabulary('en');
  }

  refreshVocabulary(): void {
    this.store.loadVocabulary('en');
  }

  getTagIcon(tagName: string): string {
    return this.tagIconMap().get(tagName) || '&#127991;&#65039;';
  }

  async addToFlashcards(item: { word: string; translation: string; hobbyTagName: string }): Promise<void> {
    try {
      await this.flashcardService.createFlashcard({
        word: item.word,
        sourceLanguage: 'en',
        contextSentence: this.i18n.translate('vocabDisplay.contextSentence', { tag: item.hobbyTagName }),
        translation: item.translation,
      });
<<<<<<< HEAD
      showToast('Added to flashcards successfully', 'success');
    } catch (error) {
      void error; // error handled via toast
      showErrorToast('Failed to add to flashcards');
=======
      showToast(this.i18n.translate('vocabDisplay.addSuccess'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('vocabDisplay.addError'));
>>>>>>> origin/main
    }
  }
}
