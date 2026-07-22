import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore, PronunciationScoreResult, GrammarCheckResult } from '../../services/vocabulary.store';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';

@Component({
  selector: 'app-vocabulary-dashboard',
  imports: [CommonModule, FormsModule, TokenisedTextComponent, TranslatePipe],
  templateUrl: './vocabulary-dashboard.component.html',
  styleUrls: ['./vocabulary-dashboard.component.scss']
})
export class VocabularyDashboardComponent implements OnInit {
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);

  readonly activeTab = signal<'review' | 'all' | 'ai-practice'>('review');
  readonly currentReviewIndex = signal<number>(0);
  readonly isCardFlipped = signal<boolean>(false);

  // AI Practice fields
  practiceText = '';
  practiceAudioUrl = '';
  readonly grammarResult = signal<GrammarCheckResult | null>(null);
  readonly pronunciationResult = signal<PronunciationScoreResult | null>(null);
  readonly isAiLoading = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    this.practiceText = this.i18n.translate('vocab.defaultPracticeText');
    await this.vocabStore.loadAllFlashcards();
    await this.vocabStore.loadDueReviews();
  }

  flipCard(): void {
    this.isCardFlipped.set(!this.isCardFlipped());
  }

  async gradeReview(newLevel: number): Promise<void> {
    const due = this.vocabStore.dueReviews();
    const currentCard = due[this.currentReviewIndex()];
    if (!currentCard) return;

    try {
      await this.vocabStore.updateSrsLevel(currentCard.id, newLevel);
      this.isCardFlipped.set(false);
      if (this.currentReviewIndex() < due.length - 1) {
        this.currentReviewIndex.update(i => i + 1);
      } else {
        await this.vocabStore.loadDueReviews();
        this.currentReviewIndex.set(0);
      }
    } catch (e) {
      console.error('Failed to grade review card:', e);
    }
  }

  async runGrammarCheck(): Promise<void> {
    if (!this.practiceText.trim()) return;
    this.isAiLoading.set(true);
    try {
      const res = await this.vocabStore.checkGrammar(this.practiceText.trim());
      this.grammarResult.set(res);
    } catch (e) {
      console.error('Grammar check error:', e);
      alert(this.i18n.translate('vocab.grammarErrorAlert'));
    } finally {
      this.isAiLoading.set(false);
    }
  }

  async runPronunciationScore(): Promise<void> {
    if (!this.practiceText.trim()) return;
    this.isAiLoading.set(true);
    try {
      // Mock or recorded audio URL
      const audioUrl = this.practiceAudioUrl || 'https://mock-audio/recording.webm';
      const res = await this.vocabStore.scorePronunciation(audioUrl, this.practiceText.trim());
      this.pronunciationResult.set(res);
    } catch (e) {
      console.error('Pronunciation score error:', e);
      alert(this.i18n.translate('vocab.pronunciationErrorAlert'));
    } finally {
      this.isAiLoading.set(false);
    }
  }
}
