import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  signal,
  computed,
  input,
  output,
  viewChild,
  ErrorHandler,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { VocabularyStore, TranslationResult, Flashcard } from '../../services/vocabulary.store';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';

@Component({
  selector: 'app-word-definition-modal',
  imports: [HlmButton, TranslatePipe, SrsErrorBoundaryComponent],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-surface-100 bg-surface-300 p-6 shadow-2xl"
        >
          @if (isLoading()) {
            <div class="text-center py-8" role="status" aria-busy="true">
              <p class="animate-spin text-2xl" aria-hidden="true">&#8635;</p>
              <p class="mt-3 text-sm text-text-secondary">{{ 'wordModal.loading' | t }}</p>
            </div>
          } @else if (translationResult(); as result) {
            <div class="space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-xl font-black text-text-primary">{{ wordToken() }}</h3>
                  <p class="text-sm font-bold text-success">{{ result.translated_text }}</p>
                </div>
                <button
                  hlmBtn
                  (click)="close()"
                  class="rounded-app p-1.5 text-text-muted hover:bg-surface-200 hover:text-text-primary"
                  [attr.aria-label]="'wordModal.closeAriaLabel' | t"
                >
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              @if (result.definition) {
                <p class="text-sm text-text-secondary">{{ result.definition }}</p>
              }
              @if (result.pronunciation_url) {
                <button
                  hlmBtn
                  (click)="playAudio()"
                  class="rounded-app border border-surface-100 px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-200"
                >
                  &#128266; {{ 'wordModal.playAudio' | t }}
                </button>
              }
              <div class="border-t border-surface-100 pt-4">
                <p class="mb-2 text-xs font-bold text-text-primary">
                  {{ 'wordModal.srsLabel' | t }}
                </p>
                <div class="flex gap-2">
                  <button
                    hlmBtn
                    (click)="setLevel(0)"
                    [disabled]="isSaving()"
                    class="flex-1 rounded-app bg-danger/20 py-2 text-xs font-bold text-danger hover:bg-danger/30 disabled:opacity-50"
                  >
                    {{ 'wordModal.resetBtn' | t }}
                  </button>
                  <button
                    hlmBtn
                    (click)="setLevel(1)"
                    [disabled]="isSaving()"
                    class="flex-1 rounded-app bg-warning/20 py-2 text-xs font-bold text-warning hover:bg-warning/30 disabled:opacity-50"
                  >
                    {{ 'wordModal.learningBtn' | t }}
                  </button>
                  <button
                    hlmBtn
                    (click)="setLevel(4)"
                    [disabled]="isSaving()"
                    class="flex-1 rounded-app bg-success/20 py-2 text-xs font-bold text-success hover:bg-success/30 disabled:opacity-50"
                  >
                    {{ 'wordModal.knownBtn' | t }}
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </app-srs-error-boundary>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class WordDefinitionModalComponent {
  readonly vocabStore = inject(VocabularyStore);
  private readonly sanitisation = inject(HtmlSanitisationService);
  private errorHandler = inject(ErrorHandler);

  wordToken = input.required<string>();
  contextSentence = input<string>('');
  targetLanguage = input<string>('en');

  closed = output<void>();
  statusChanged = output<Flashcard>();

  readonly translationResult = signal<TranslationResult | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly existingCard = signal<Flashcard | null>(null);

  readonly errorBoundary = viewChild(SrsErrorBoundaryComponent);

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'word-definition-modal',
    operation: 'lookup',
    metadata: {
      wordToken: this.wordToken(),
      targetLanguage: this.targetLanguage(),
      hasExistingCard: !!this.existingCard(),
    },
  }));

  readonly sanitisedWordToken = computed(() => this.sanitisation.sanitiseText(this.wordToken()));

  constructor() {
    this.fetchDefinition().catch(() => undefined);
  }

  handleRetry(): void {
    this.fetchDefinition().catch(() => undefined);
  }

  async fetchDefinition(): Promise<void> {
    this.isLoading.set(true);
    try {
      const token = this.wordToken();
      const targetLang = this.targetLanguage();
      const status = this.vocabStore.getWordStatus(token);
      if (status.flashcard) {
        this.existingCard.set(status.flashcard);
      }
      const res = await this.vocabStore.translateWordOrSentence(token, targetLang);
      this.translationResult.set({
        ...res,
        original_text: this.sanitisation.sanitiseText(res.original_text),
        translated_text: this.sanitisation.sanitiseText(res.translated_text),
        detected_language: this.sanitisation.sanitiseText(res.detected_language),
        transliteration: res.transliteration
          ? this.sanitisation.sanitiseText(res.transliteration)
          : undefined,
        definition: res.definition ? this.sanitisation.sanitiseText(res.definition) : undefined,
        pronunciation_url: res.pronunciation_url
          ? this.sanitisation.sanitiseUrl(res.pronunciation_url)
          : undefined,
      });
    } catch (e) {
      this.translationResult.set({
        original_text: this.wordToken(),
        translated_text: `Translation of "${this.wordToken()}"`,
        detected_language: 'auto',
        definition: 'Click "Save to Learning" to track this word in your SRS flashcard deck.',
        transliteration: this.wordToken(),
      });
      this.handleError(e, 'fetchDefinition');
    } finally {
      this.isLoading.set(false);
    }
  }

  playAudio(): void {
    const url = this.translationResult()?.pronunciation_url;
    if (url) {
      const safeUrl = this.sanitisation.sanitiseUrl(url);
      if (safeUrl) {
        const audio = new Audio(safeUrl);
        audio.play().catch((err) => {
          this.handleError(err, 'playAudio');
        });
      }
    }
  }

  async setLevel(level: number): Promise<void> {
    this.isSaving.set(true);
    try {
      const qualityMap: Record<number, number> = { 0: 0, 1: 3, 4: 5 };
      const quality = qualityMap[level] ?? 3;

      if (this.existingCard()) {
        const updated = await this.vocabStore.updateSrsLevel(this.existingCard()!.id, quality);
        this.existingCard.set(updated);
        this.statusChanged.emit(updated);
      } else {
        const created = await this.vocabStore.saveWord({
          word_token: this.wordToken(),
          translation:
            this.translationResult()?.translated_text ||
            `Word: ${this.sanitisation.sanitiseText(this.wordToken())}`,
          original_context: this.contextSentence(),
          definition: this.translationResult()?.definition,
          pronunciation_url: this.translationResult()?.pronunciation_url,
        });
        if (level !== 0) {
          const updated = await this.vocabStore.updateSrsLevel(created.id, quality);
          this.existingCard.set(updated);
          this.statusChanged.emit(updated);
        } else {
          this.existingCard.set(created);
          this.statusChanged.emit(created);
        }
      }
    } catch (err) {
      this.handleError(err, 'setLevel');
    } finally {
      this.isSaving.set(false);
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }

  private handleError(err: unknown, operation: string): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.errorBoundary()?.captureError(error, undefined, {
      operation,
      wordToken: this.wordToken(),
      srsLevel: this.existingCard()?.srs_level,
    });
  }
}
