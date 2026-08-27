import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, computed, viewChild, ErrorHandler } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { HobbyTagsStore } from '../../services/hobby-tags.store';
import { FlashcardService } from '../../services/flashcard.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-vocabulary-display',
  imports: [HlmButton, TranslatePipe, SrsErrorBoundaryComponent, AppCardComponent],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto max-w-5xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="app-section-title">{{ 'vocabDisplay.title' | t }}</h3>
          <button
            hlmBtn
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

        @if (vocabularyByTag().size === 0) {
          <div class="app-empty-state" role="status">
            <p class="text-3xl mb-3" aria-hidden="true">&#128218;</p>
            <p class="font-bold text-text-primary">{{ 'vocabDisplay.emptyTitle' | t }}</p>
            <p class="app-muted mt-1">{{ 'vocabDisplay.emptyDesc' | t }}</p>
          </div>
        }

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (entry of vocabularyByTagEntries(); track entry[0]) {
            <app-card customClass="app-padded space-y-3">
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
                      hlmBtn
                      (click)="addToFlashcards(item)"
                      class="rounded-app ms-2 bg-primary ps-2.5 pe-2.5 pt-1 pb-1 text-[11px] font-bold text-on-fill hover:opacity-90 flex-shrink-0"
                      [attr.aria-label]="'vocabDisplay.addToSrsAriaLabel' | t: { word: item.word }"
                    >
                      {{ 'vocabDisplay.addToSrs' | t }}
                    </button>
                  </div>
                }
              </div>
            </app-card>
          }
        </div>
      </div>
    </app-srs-error-boundary>
  `,
})
export class VocabularyDisplayComponent {
  private readonly store = inject(HobbyTagsStore);
  private readonly flashcardService = inject(FlashcardService);
  private readonly i18n = inject(I18nService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly loading = computed(() => this.store.loading());
  readonly vocabularyByTag = computed(() => this.store.vocabularyByTag());
  readonly vocabularyByTagEntries = computed(() => Array.from(this.vocabularyByTag().entries()));

  readonly errorBoundary = viewChild(SrsErrorBoundaryComponent);

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'vocabulary-display',
    operation: 'display',
    metadata: {
      tagCount: this.vocabularyByTag().size,
    },
  }));

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

  handleRetry(): void {
    this.refreshVocabulary();
  }

  refreshVocabulary(): void {
    try {
      this.store.loadVocabulary('en');
    } catch (err) {
      this.handleError(err, 'refreshVocabulary');
    }
  }

  getTagIcon(tagName: string): string {
    return this.tagIconMap().get(tagName) || '&#127991;&#65039;';
  }

  async addToFlashcards(item: {
    word: string;
    translation: string;
    hobbyTagName: string;
  }): Promise<void> {
    try {
      await this.flashcardService.createFlashcard({
        word_token: item.word,
        original_context: this.i18n.translate('vocabDisplay.contextSentence', {
          tag: item.hobbyTagName,
        }),
        translation: item.translation,
      });
      showToast(this.i18n.translate('vocabDisplay.addSuccess'), 'success');
    } catch (err) {
      showErrorToast(this.i18n.translate('vocabDisplay.addError'));
      this.handleError(err, 'addToFlashcards');
    }
  }

  private handleError(err: unknown, operation: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.errorBoundary()?.captureError(error, undefined, {
      operation,
      tagCount: this.vocabularyByTag().size,
    });
  }
}
