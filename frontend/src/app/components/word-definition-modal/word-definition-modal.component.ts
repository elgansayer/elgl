import { showToast } from '../../services/toast.service';
import { Component, inject, signal, input, output, effect, ErrorHandler } from '@angular/core';
import { VocabularyStore, TranslationResult, Flashcard } from '../../services/vocabulary.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-word-definition-modal',
  imports: [TranslatePipe],
  templateUrl: './word-definition-modal.component.html',
  styleUrls: ['./word-definition-modal.component.scss'],
})
export class WordDefinitionModalComponent {
  readonly vocabStore = inject(VocabularyStore);
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

  constructor() {
    // Auto-fetch definition when word token changes, replacing ngOnInit
    effect(() => {
      const token = this.wordToken();
      const target = this.targetLanguage();
      const status = this.vocabStore.getWordStatus(token);
      if (status.flashcard) {
        this.existingCard.set(status.flashcard);
      }
      void this.fetchDefinition(token, target);
    });
  }

  async fetchDefinition(wordToken: string, targetLang: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.vocabStore.translateWordOrSentence(wordToken, targetLang);
      this.translationResult.set(res);
    } catch (e) {
      this.reportError('fetchDefinition', e);
      // Fallback display
      this.translationResult.set({
        original_text: wordToken,
        translated_text: `Translation of "${wordToken}"`,
        detected_language: 'auto',
        definition: 'Click "Save to Learning" to track this word in your SRS flashcard deck.',
        transliteration: wordToken,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  playAudio(): void {
    const url = this.translationResult()?.pronunciation_url;
    if (url) {
      const audio = new Audio(url);
      audio.play().catch((e) => this.reportError('playAudio', e));
    }
  }

  async setLevel(level: number): Promise<void> {
    this.isSaving.set(true);
    try {
      // Map old srs_level to SM-2 quality (0-5 scale):
      //   0 (reset/new) -> quality 0 (complete blackout)
      //   1 (learning)   -> quality 3 (correct with serious difficulty)
      //   4 (known)      -> quality 5 (perfect response)
      const qualityMap: Record<number, number> = { 0: 0, 1: 3, 4: 5 };
      const quality = qualityMap[level] ?? 3;

      if (this.existingCard()) {
        const updated = await this.vocabStore.updateSrsLevel(this.existingCard()!.id, quality);
        this.existingCard.set(updated);
        this.statusChanged.emit(updated);
      } else {
        const created = await this.vocabStore.saveWord({
          word_token: this.wordToken(),
          translation: this.translationResult()?.translated_text || `Word: ${this.wordToken()}`,
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
    } catch (e) {
      this.reportError('setLevel', e);
      showToast('Error updating SRS review schedule.');
    } finally {
      this.isSaving.set(false);
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }

  private reportError(operation: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const srsError = new Error(`[SRS:WordDefinition] ${operation} failed: ${message}`);
    if (err instanceof Error && err.stack) {
      srsError.stack = err.stack;
    }
    this.errorHandler.handleError(srsError);
  }
}
