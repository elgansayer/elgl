import {
  Component,
  ErrorHandler,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';

import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { Flashcard, TranslationResult, VocabularyStore } from '../../services/vocabulary.store';

const MAX_LOOKUP_TOKEN_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 2_000;
const LANGUAGE_CODE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

@Component({
  selector: 'app-word-definition-modal',
  imports: [RouterLink, ...HlmButtonImports, ...HlmDialogImports, TranslatePipe],
  template: `
    <hlm-dialog state="open" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[min(90dvh,48rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-sheet border border-surface-100 bg-surface-300 p-4 shadow-lift sm:p-6"
      >
        <hlm-dialog-header class="min-w-0 text-start">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 hlmDialogTitle class="break-words text-xl font-black text-text-primary">
                {{ wordToken() }}
              </h2>
              <p hlmDialogDescription class="sr-only">
                {{ 'wordModal.srsLabel' | t }}
              </p>
            </div>
            <button
              hlmBtn
              type="button"
              variant="ghost"
              size="icon"
              class="min-h-11 min-w-11 shrink-0 rounded-app text-text-muted hover:bg-surface-200 hover:text-text-primary"
              [disabled]="isSaving()"
              [attr.aria-label]="'wordModal.closeAriaLabel' | t"
              (click)="close()"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </hlm-dialog-header>

        @if (isLoading()) {
          <div class="py-8 text-center" role="status" aria-live="polite" aria-busy="true">
            <p class="text-2xl" aria-hidden="true">&#8635;</p>
            <p class="mt-3 text-sm text-text-secondary">{{ 'wordModal.loading' | t }}</p>
          </div>
        } @else if (lookupFailed()) {
          <div class="space-y-4 py-4">
            <p
              class="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              role="alert"
            >
              {{ 'common.error_generic' | t }}
            </p>
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              class="w-full sm:w-auto"
              (click)="handleRetry()"
            >
              {{ 'srsErrorBoundary.retryBtn' | t }}
            </button>
          </div>
        } @else if (translationResult(); as result) {
          <div class="space-y-4">
            <p class="break-words text-sm font-bold text-success">
              {{ result.translated_text }}
            </p>

            @if (result.transliteration && result.transliteration !== result.translated_text) {
              <p class="break-words text-sm text-text-muted">{{ result.transliteration }}</p>
            }

            @if (result.definition) {
              <p class="break-words text-sm leading-relaxed text-text-secondary">
                {{ result.definition }}
              </p>
            }

            @if (result.pronunciation_url) {
              <div class="space-y-2">
                <button
                  hlmBtn
                  type="button"
                  variant="secondary"
                  size="touch"
                  class="w-full sm:w-auto"
                  [disabled]="isAudioPlaying()"
                  [attr.aria-busy]="isAudioPlaying() ? 'true' : null"
                  (click)="playAudio()"
                >
                  <span aria-hidden="true">&#128266;</span>
                  {{ 'wordModal.playAudio' | t }}
                </button>
                @if (audioFailed()) {
                  <p role="alert" class="text-xs text-danger">{{ 'common.error_generic' | t }}</p>
                }
              </div>
            }

            <div class="border-t border-surface-100 pt-4">
              <p class="mb-2 text-xs font-bold text-text-primary">
                {{ 'wordModal.srsLabel' | t }}
              </p>

              @if (saveFailed()) {
                <p
                  role="alert"
                  class="mb-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
                >
                  {{ 'common.error_generic' | t }}
                </p>
              }

              <div class="flex flex-col gap-2 sm:flex-row">
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  (click)="setLevel(0)"
                  [disabled]="isSaving()"
                  class="flex-1 rounded-app bg-danger/20 text-xs font-bold text-danger hover:bg-danger/30 disabled:opacity-50"
                >
                  {{ 'wordModal.resetBtn' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  (click)="setLevel(1)"
                  [disabled]="isSaving()"
                  class="flex-1 rounded-app bg-warning/20 text-xs font-bold text-warning hover:bg-warning/30 disabled:opacity-50"
                >
                  {{ 'wordModal.learningBtn' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  (click)="setLevel(4)"
                  [disabled]="isSaving()"
                  class="flex-1 rounded-app bg-success/20 text-xs font-bold text-success hover:bg-success/30 disabled:opacity-50"
                >
                  {{ 'wordModal.knownBtn' | t }}
                </button>
              </div>

              <button hlmBtn [routerLink]="['/review']" size="touch" variant="outline" class="w-full mt-3 border-primary text-primary hover:bg-primary/10">
                Review Flashcards
              </button>
            </div>
          </div>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class WordDefinitionModalComponent implements OnInit, OnDestroy {
  readonly vocabStore = inject(VocabularyStore);
  private readonly sanitisation = inject(HtmlSanitisationService);
  private readonly i18n = inject(I18nService);
  private readonly errorHandler = inject(ErrorHandler);

  readonly wordToken = input.required<string>();
  readonly contextSentence = input<string>('');
  readonly targetLanguage = input<string>('');

  readonly closed = output<void>();
  readonly statusChanged = output<Flashcard>();

  readonly translationResult = signal<TranslationResult | null>(null);
  readonly isLoading = signal(true);
  readonly lookupFailed = signal(false);
  readonly isSaving = signal(false);
  readonly saveFailed = signal(false);
  readonly isAudioPlaying = signal(false);
  readonly audioFailed = signal(false);
  readonly existingCard = signal<Flashcard | null>(null);

  readonly resolvedTargetLanguage = computed(() => {
    const explicit = this.targetLanguage().trim();
    if (explicit) return explicit;
    return this.i18n.currentLang().split('-')[0] || 'en';
  });

  private activeAudio: HTMLAudioElement | null = null;
  private lookupGeneration = 0;
  private hasClosed = false;

  ngOnInit(): void {
    void this.fetchDefinition();
  }

  ngOnDestroy(): void {
    this.lookupGeneration += 1;
    this.stopAudio();
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed') this.close();
  }

  handleRetry(): void {
    if (this.isLoading()) return;
    void this.fetchDefinition();
  }

  async fetchDefinition(): Promise<void> {
    const generation = ++this.lookupGeneration;
    this.isLoading.set(true);
    this.lookupFailed.set(false);
    this.audioFailed.set(false);
    this.translationResult.set(null);

    try {
      const token = this.wordToken().trim();
      const targetLang = this.resolvedTargetLanguage().trim();
      if (!token || token.length > MAX_LOOKUP_TOKEN_LENGTH || !LANGUAGE_CODE_RE.test(targetLang)) {
        throw new Error('Invalid word-definition lookup input');
      }

      const status = this.vocabStore.getWordStatus(token);
      this.existingCard.set(status.flashcard ?? null);

      const result = await this.vocabStore.translateWordOrSentence(token, targetLang);
      if (generation !== this.lookupGeneration) return;

      const definition = result.definition?.toLowerCase() ?? '';
      const providerUnavailable =
        !result.translated_text?.trim() ||
        (result.translated_text.trim().toLowerCase() === token.toLowerCase() &&
          (definition.includes('service is currently unavailable') ||
            definition.includes('translation service temporarily unavailable')));
      if (providerUnavailable) {
        throw new Error('Word-definition provider unavailable');
      }

      this.translationResult.set({
        ...result,
        original_text: this.sanitisation.sanitiseText(result.original_text),
        translated_text: this.sanitisation.sanitiseText(result.translated_text),
        detected_language: this.sanitisation.sanitiseText(result.detected_language),
        transliteration: result.transliteration
          ? this.sanitisation.sanitiseText(result.transliteration)
          : undefined,
        definition: result.definition
          ? this.sanitisation.sanitiseText(result.definition)
          : undefined,
        pronunciation_url: result.pronunciation_url
          ? this.sanitisation.sanitiseUrl(result.pronunciation_url) || undefined
          : undefined,
      });
    } catch (error) {
      if (generation !== this.lookupGeneration) return;
      this.lookupFailed.set(true);
      this.reportError(error, 'lookup');
    } finally {
      if (generation === this.lookupGeneration) this.isLoading.set(false);
    }
  }

  playAudio(): void {
    if (this.isAudioPlaying()) return;

    const rawUrl = this.translationResult()?.pronunciation_url;
    const safeUrl = rawUrl ? this.sanitisation.sanitiseUrl(rawUrl) : '';
    if (!safeUrl) return;

    this.stopAudio();
    this.audioFailed.set(false);

    const audio = new Audio(safeUrl);
    this.activeAudio = audio;
    this.isAudioPlaying.set(true);

    audio.addEventListener(
      'ended',
      () => {
        if (this.activeAudio === audio) {
          this.activeAudio = null;
          this.isAudioPlaying.set(false);
        }
      },
      { once: true },
    );

    audio.play().catch((error) => {
      if (this.activeAudio === audio) {
        this.activeAudio = null;
        this.isAudioPlaying.set(false);
        this.audioFailed.set(true);
      }
      this.reportError(error, 'pronunciation-audio');
    });
  }

  async setLevel(level: number): Promise<void> {
    if (this.isSaving()) return;

    this.isSaving.set(true);
    this.saveFailed.set(false);
    let completed = false;

    try {
      const qualityMap: Record<number, number> = { 0: 0, 1: 3, 4: 5 };
      const quality = qualityMap[level] ?? 3;
      let card = this.existingCard();

      if (!card) {
        const token = this.wordToken().trim();
        const result = this.translationResult();
        if (!result) throw new Error('Cannot save a word before lookup completes');

        card = await this.vocabStore.saveWord({
          word_token: token,
          translation: result.translated_text,
          original_context: this.contextSentence().slice(0, MAX_CONTEXT_LENGTH),
          definition: result.definition,
          pronunciation_url: result.pronunciation_url,
        });

        // Persist this immediately so a retry after a partial failure updates the
        // same flashcard instead of issuing a duplicate create request.
        this.existingCard.set(card);
      }

      let finalCard = card;
      if (level !== 0 || card.srs_level !== 0) {
        finalCard = await this.vocabStore.updateSrsLevel(card.id, quality);
        this.existingCard.set(finalCard);
      }

      this.statusChanged.emit(finalCard);
      completed = true;
    } catch (error) {
      this.saveFailed.set(true);
      this.reportError(error, 'save-srs-status');
    } finally {
      this.isSaving.set(false);
    }

    if (completed) this.close();
  }

  close(): void {
    if (this.hasClosed) return;
    this.hasClosed = true;
    this.stopAudio();
    this.closed.emit();
  }

  private stopAudio(): void {
    const audio = this.activeAudio;
    this.activeAudio = null;
    this.isAudioPlaying.set(false);
    if (!audio) return;

    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some streaming audio sources do not allow seeking before metadata loads.
    }
  }

  private reportError(error: unknown, operation: string): void {
    const source = error instanceof Error ? error : new Error(String(error));
    const wrapped = new Error(`[WordDefinitionModal] ${operation} failed`);
    wrapped.name = source.name;
    if (source.stack) wrapped.stack = source.stack;
    this.errorHandler.handleError(wrapped);
  }
}
