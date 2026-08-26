import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  signal,
  input,
  effect,
  computed,
  viewChild,
  ErrorHandler,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { SuggestFlashcardsService, SuggestResult } from '../../services/suggest-flashcards.service';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppTextareaComponent } from '../primitives/textarea/textarea.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-suggest-flashcards',
  standalone: true,
  imports: [
    HlmButton,
    TranslatePipe,
    SrsErrorBoundaryComponent,
    AppCardComponent,
    AppTextareaComponent,
    AppButtonPrimaryComponent,
  ],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto max-w-2xl space-y-4 pb-20 pt-4">
        <app-card customClass="app-padded space-y-4">
          <h2 class="app-section-title">{{ 'suggest_flashcards.title' | t }}</h2>
          <app-textarea
            [value]="messageInput()"
            (valueChange)="messageInput.set($event)"
            [placeholder]="'suggest_flashcards.placeholder' | t"
          />
          <app-button-primary
            (clicked)="manualSuggest()"
            [disabled]="!messageInput().trim() || loading()"
            customClass="text-xs font-bold"
          >
            {{ 'suggest_flashcards.suggest_button' | t }}
          </app-button-primary>
          @if (loading()) {
            <p class="app-muted" role="status" aria-live="polite">
              {{ 'suggest_flashcards.loading' | t }}
            </p>
          }
          @if (suggestions().length > 0) {
            <ul class="mt-4 divide-y divide-surface-700">
              @for (word of suggestions(); track word) {
                <li class="flex items-center justify-between gap-3 py-2.5">
                  <span class="min-w-0 break-words text-sm font-medium text-text-primary" dir="auto">{{ word }}</span>
                  <button
                    hlmBtn
                    (click)="addWordToDeck(word)"
                    [disabled]="addingWords().has(word) || addedWords().has(word)"
                    class="min-h-11 shrink-0 rounded-lg border border-neon-primary px-3 py-1 text-xs font-semibold text-neon-primary transition-colors hover:bg-neon-primary/10 disabled:border-surface-500 disabled:text-surface-400"
                  >
                    @if (addingWords().has(word)) {
                      {{ 'suggest_flashcards.loading' | t }}
                    } @else if (addedWords().has(word)) {
                      {{ 'suggest_flashcards.addedButton' | t }}
                    } @else {
                      {{ 'suggest_flashcards.addButton' | t }}
                    }
                  </button>
                </li>
              }
            </ul>
          }
          @if (suggestions().length === 0 && !loading() && hasAttempted()) {
            <p class="text-sm text-text-muted" role="status">{{ 'suggest_flashcards.noWordsFound' | t }}</p>
          }
          @if (error()) {
            <p class="mt-2 text-xs font-bold text-danger" role="alert">{{ error() }}</p>
          }
        </app-card>
      </div>
    </app-srs-error-boundary>
  `,
})
export class SuggestFlashcardsComponent {
  private suggestService = inject(SuggestFlashcardsService);
  private i18n = inject(I18nService);
  private vocabStore = inject(VocabularyStore);
  private errorHandler = inject(ErrorHandler);
  private suggestionRequestId = 0;

  /** Optional external message to auto-suggest (e.g. from chat). */
  externalMessage = input<string>('');
  externalTargetLanguage = input<string | undefined>(undefined);

  messageInput = signal<string>('');
  suggestions = signal<string[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  hasAttempted = signal<boolean>(false);
  addingWords = signal<Set<string>>(new Set());
  addedWords = signal<Set<string>>(new Set());

  readonly errorBoundary = viewChild(SrsErrorBoundaryComponent);

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'suggest-flashcards',
    operation: 'suggest',
    metadata: {
      messageLength: this.messageInput().length,
      hasExternalMessage: !!this.externalMessage(),
    },
  }));

  constructor() {
    effect(() => {
      const message = this.externalMessage().trim();
      if (message) {
        this.messageInput.set(message);
        void this.runSuggest(message, this.externalTargetLanguage());
      }
    });
  }

  handleRetry(): void {
    this.error.set(null);
    const message = this.messageInput().trim();
    if (message) {
      void this.runSuggest(message, this.externalTargetLanguage());
    }
  }

  async manualSuggest(): Promise<void> {
    const message = this.messageInput().trim();
    if (!message || this.loading()) return;
    await this.runSuggest(message, this.externalTargetLanguage());
  }

  async addWordToDeck(word: string): Promise<void> {
    if (this.addedWords().has(word) || this.addingWords().has(word)) return;
    this.addingWords.update((set) => new Set(set).add(word));
    try {
      await this.vocabStore.saveWord({
        word_token: word,
        translation: '',
        original_context: this.messageInput().trim(),
      });
      this.addedWords.update((set) => new Set(set).add(word));
    } catch (error) {
      this.handleError(error, 'addWordToDeck');
    } finally {
      this.addingWords.update((set) => {
        const next = new Set(set);
        next.delete(word);
        return next;
      });
    }
  }

  private async runSuggest(message: string, targetLanguage?: string): Promise<void> {
    const requestId = ++this.suggestionRequestId;
    this.loading.set(true);
    this.error.set(null);
    this.suggestions.set([]);
    this.hasAttempted.set(false);
    this.addedWords.set(new Set());

    try {
      const result: SuggestResult = await this.suggestService.suggestFromMessage(
        message,
        targetLanguage,
        true,
      );
      if (requestId !== this.suggestionRequestId) return;
      this.suggestions.set(result.suggestions);
      this.hasAttempted.set(true);
    } catch (error) {
      if (requestId !== this.suggestionRequestId) return;
      this.error.set(this.i18n.translate('suggest_flashcards.error'));
      this.handleError(error, 'runSuggest');
    } finally {
      if (requestId === this.suggestionRequestId) {
        this.loading.set(false);
      }
    }
  }

  private handleError(error: unknown, operation: string): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.errorHandler.handleError(normalized);
    this.errorBoundary()?.captureError(normalized, undefined, {
      operation,
      messageLength: this.messageInput().length,
    });
  }
}
