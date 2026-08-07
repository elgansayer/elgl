import { Component, inject, computed } from '@angular/core';

import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast, showErrorToast } from '../../services/toast.service';


@Component({
  selector: 'app-vocabulary-display',
  imports: [],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-slate-200">Vocabulary from your interests</h3>
        <button
          (click)="refreshVocabulary()"
          class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          [disabled]="loading()"
        >
          @if (loading()) {
            <span class="inline-block animate-spin">⟳</span>
          } @else {
            Refresh
          }
        </button>
      </div>

      @if (vocabularyByTag().size === 0) {
        <div
          class="p-8 text-center text-text-muted bg-surface-800/30 rounded-xl border border-dashed border-slate-700"
        >
          <p class="text-lg mb-2">📚</p>
          <p>No vocabulary yet. Select some hobbies to get started!</p>
        </div>
      }

      @for (entry of vocabularyByTagEntries(); track entry[0]) {
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span>{{ getTagIcon(entry[0]) }}</span>
            <span>{{ entry[0] }}</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            @for (item of entry[1]; track item.word) {
              <div
                class="flex items-center justify-between p-3 bg-surface-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-slate-200">{{ item.word }}</p>
                  <p class="text-xs text-text-muted">{{ item.translation }}</p>
                </div>
                <button
                  (click)="addToFlashcards(item)"
                  class="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                  title="Add to flashcards"
                >
                  + SRS
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
    this.store.loadVocabulary('en');
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
        sourceLanguage: 'en', // default for now, could be passed or inferred
        contextSentence: `Vocabulary from hobby: ${item.hobbyTagName}`,
        translation: item.translation
      });
      showToast('Added to flashcards successfully', 'success');
    } catch (error) {
      console.error('Failed to add to flashcards:', error);
      showErrorToast('Failed to add to flashcards');
    }
  }
}
