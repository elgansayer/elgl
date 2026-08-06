import { showToast } from '../../services/toast.service';
import { Component, OnInit, inject, signal, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { VocabularyStore, TranslationResult, Flashcard } from '../../services/vocabulary.store';

@Component({
  selector: 'app-word-definition-modal',
  imports: [TranslatePipe],
  templateUrl: './word-definition-modal.component.html',
  styleUrls: ['./word-definition-modal.component.scss'],
})
export class WordDefinitionModalComponent implements OnInit {
  readonly vocabStore = inject(VocabularyStore);

  wordToken = input.required<string>();
  contextSentence = input<string>('');
  targetLanguage = input<string>('en');

  closed = output<void>();
  statusChanged = output<Flashcard>();

  readonly translationResult = signal<TranslationResult | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly existingCard = signal<Flashcard | null>(null);

  async ngOnInit(): Promise<void> {
    const status = this.vocabStore.getWordStatus(this.wordToken());
    if (status.flashcard) {
      this.existingCard.set(status.flashcard);
    }
    await this.fetchDefinition();
  }

  async fetchDefinition(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await this.vocabStore.translateWordOrSentence(
        this.wordToken(),
        this.targetLanguage(),
      );
      this.translationResult.set(res);
    } catch (e) {
      console.error('Failed to translate word token:', e);
      // Fallback display
      this.translationResult.set({
        original_text: this.wordToken(),
        translated_text: `Translation of "${this.wordToken()}"`,
        detected_language: 'auto',
        definition: 'Click "Save to Learning" to track this word in your SRS flashcard deck.',
        transliteration: this.wordToken(),
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  playAudio(): void {
    const url = this.translationResult()?.pronunciation_url;
    if (url) {
      const audio = new Audio(url);
      audio.play().catch((e) => console.error('Audio playback error:', e));
    }
  }

  async setLevel(level: number): Promise<void> {
    this.isSaving.set(true);
    try {
      if (this.existingCard()) {
        const updated = await this.vocabStore.updateSrsLevel(this.existingCard()!.id, level);
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
          const updated = await this.vocabStore.updateSrsLevel(created.id, level);
          this.existingCard.set(updated);
          this.statusChanged.emit(updated);
        } else {
          this.existingCard.set(created);
          this.statusChanged.emit(created);
        }
      }
    } catch (e) {
      console.error('Failed to update word status:', e);
      showToast('Error updating SRS review schedule.');
    } finally {
      this.isSaving.set(false);
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
