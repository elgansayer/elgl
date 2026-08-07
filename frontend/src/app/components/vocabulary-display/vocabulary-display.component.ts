import { Component, inject, computed, afterNextRender } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-vocabulary-display',
  imports: [TranslatePipe],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
<<<<<<< HEAD
        <h3 class="text-lg font-bold text-slate-200">{{ 'components.vocabulary-display.vocabularyFromYourInteres' | t }}</h3>
=======
        <h3 class="text-lg font-bold text-text-primary">{{ 'vocabulary.title' | t }}</h3>
>>>>>>> origin/main
        <button
          (click)="refreshVocabulary()"
          class="text-sm text-primary hover:text-primary/80 transition-colors"
          [disabled]="loading()"
        >
          @if (loading()) {
            <span class="inline-block animate-spin">⟳</span>
          } @else {
            {{ 'vocabulary.refresh' | t }}
          }
        </button>
      </div>

      @if (vocabularyByTag().size === 0) {
        <div
          class="p-8 text-center text-text-muted bg-surface-800/30 rounded-xl border border-dashed border-surface-100"
        >
          <p class="text-lg mb-2">📚</p>
<<<<<<< HEAD
          <p>{{ 'components.vocabulary-display.noVocabularyYetSelectSome' | t }}</p>
=======
          <p>{{ 'vocabulary.empty' | t }}</p>
>>>>>>> origin/main
        </div>
      }

      @for (entry of vocabularyByTagEntries(); track entry[0]) {
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-text-secondary flex items-center gap-2">
            <span>{{ getTagIcon(entry[0]) }}</span>
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
                  class="text-xs px-2 py-1 rounded-app bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                  [attr.aria-label]="'vocabulary.addToFlashcards' | t"
                >
                  {{ 'vocabulary.addToSrsBtn' | t }}
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class VocabularyDisplayComponent {
  private readonly store = inject(HobbyTagsStore);
  private readonly flashcardService = inject(FlashcardService);

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
    afterNextRender(() => {
      this.store.loadVocabulary('en');
    });
  }

  refreshVocabulary(): void {
    this.store.loadVocabulary('en');
  }

  getTagIcon(tagName: string): string {
    return this.tagIconMap().get(tagName) || '🏷️';
  }

  async addToFlashcards(item: { word: string; translation: string; hobbyTagName: string }): Promise<void> {
    try {
      await this.flashcardService.createFlashcard({
        word: item.word,
        sourceLanguage: 'en',
        contextSentence: `Vocabulary from hobby: ${item.hobbyTagName}`,
        translation: item.translation,
      });
      showToast('Added to flashcards successfully', 'success');
    } catch {
      showErrorToast('Failed to add to flashcards');
    }
  }
}
