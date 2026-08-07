import { Component, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-vocabulary-display',
  imports: [TranslatePipe, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  template: `
    <div class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="app-section-title">{{ 'vocabDisplay.title' | t }}</h3>
        <button
          (click)="refreshVocabulary()"
          class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          [disabled]="loading()"
          [attr.aria-label]="'vocabDisplay.refreshAriaLabel' | t"
        >
          @if (loading()) {
            <span class="inline-block animate-spin" aria-hidden="true">&#8635;</span>
            {{ 'vocabDisplay.loading' | t }}
          } @else {
            {{ 'vocabDisplay.refresh' | t }}
          }
        </button>
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-busy="true">
          @for (_ of [0, 1, 2]; track _) {
            <div class="app-card app-padded space-y-3">
              <div class="flex items-center gap-2">
                <app-skeleton-loader [height]="'1.25rem'" [width]="'1.25rem'" [borderRadius]="'8px'" />
                <app-skeleton-loader [height]="'14px'" [width]="'50%'" [borderRadius]="'6px'" />
              </div>
              <div class="space-y-2">
                <div class="rounded-card border border-surface-100 px-3 py-2 flex items-center justify-between">
                  <div class="flex-1 space-y-1">
                    <app-skeleton-loader [height]="'13px'" [width]="'60%'" [borderRadius]="'6px'" />
                    <app-skeleton-loader [height]="'11px'" [width]="'40%'" [borderRadius]="'6px'" />
                  </div>
                  <app-skeleton-loader [height]="'24px'" [width]="'48px'" [borderRadius]="'8px'" />
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (vocabularyByTag().size === 0) {
        <app-empty-state
          [icon]="'📖'"
          [title]="'vocabDisplay.emptyTitle' | t"
          [description]="'vocabDisplay.emptyDesc' | t"
        />
      } @else {

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
      }
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
      showToast(this.i18n.translate('vocabDisplay.addSuccess'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('vocabDisplay.addError'));
    }
  }
}
