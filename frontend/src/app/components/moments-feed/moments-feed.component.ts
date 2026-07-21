import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MomentsStore, MomentRecord } from '../../services/moments.store';
import { VocabularyStore } from '../../services/vocabulary.store';
import { AuthService } from '../../services/auth.service';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { TextToSpeechComponent } from '../text-to-speech/text-to-speech.component';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';

@Component({
  selector: 'app-moments-feed',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TokenisedTextComponent,
    WordDefinitionModalComponent,
    TextToSpeechComponent,
    VisualDiffComponent,
    VoiceRecorderComponent
  ],
  templateUrl: './moments-feed.component.html',
  styleUrls: ['./moments-feed.component.scss']
})
export class MomentsFeedComponent implements OnInit {
  readonly momentsStore = inject(MomentsStore);
  readonly vocabStore = inject(VocabularyStore);
  readonly authService = inject(AuthService);

  readonly isCreating = signal<boolean>(false);
  readonly showVoiceRecorder = signal<boolean>(false);
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');
  readonly openCommentsMap = signal<Set<string>>(new Set());

  // New Moment form state
  newText = '';
  newMediaUrls: string[] = [];
  newMediaType: 'none' | 'images' | 'audio' = 'none';
  newTargetLanguage = 'es'; // default Spanish or user target
  tempImageUrlInput = '';

  // New Comment / Correction form states per momentId
  commentInputMap: Record<string, string> = {};
  correctionModeMap: Record<string, boolean> = {};
  correctionOriginalMap: Record<string, string> = {};
  correctionCorrectedMap: Record<string, string> = {};
  correctionExplanationMap: Record<string, string> = {};

  async ngOnInit(): Promise<void> {
    await this.momentsStore.loadFeed('All');
  }

  async setFilter(filter: 'All' | 'Classmates' | 'Following'): Promise<void> {
    await this.momentsStore.loadFeed(filter);
  }

  addTempImageUrl(): void {
    if (!this.tempImageUrlInput.trim()) return;
    if (this.newMediaUrls.length >= 9) {
      alert('You may upload a maximum of 9 media items per Moment.');
      return;
    }
    this.newMediaUrls.push(this.tempImageUrlInput.trim());
    this.newMediaType = 'images';
    this.tempImageUrlInput = '';
  }

  removeMedia(index: number): void {
    this.newMediaUrls.splice(index, 1);
    if (this.newMediaUrls.length === 0) {
      this.newMediaType = 'none';
    }
  }

  onVoiceUploaded(url: string): void {
    this.newMediaUrls = [url];
    this.newMediaType = 'audio';
    this.showVoiceRecorder.set(false);
  }

  async submitMoment(): Promise<void> {
    if (!this.newText.trim() && this.newMediaUrls.length === 0) return;
    this.isCreating.set(true);
    try {
      await this.momentsStore.createMoment({
        text_content: this.newText.trim() || undefined,
        media_urls: this.newMediaUrls,
        media_type: this.newMediaType,
        target_language: this.newTargetLanguage
      });
      this.newText = '';
      this.newMediaUrls = [];
      this.newMediaType = 'none';
    } catch (e) {
      console.error('Error submitting moment:', e);
      alert('Failed to publish Moment.');
    } finally {
      this.isCreating.set(false);
    }
  }

  onWordClicked(event: { token: string; context: string }): void {
    this.activeWordToken.set(event.token);
    this.activeWordContext.set(event.context);
  }

  async toggleInlineTranslation(moment: MomentRecord): Promise<void> {
    if (!moment.text_content) return;
    if (moment.translatedText) {
      // Toggle off
      moment.isTranslating = false;
      moment.translatedText = undefined;
      return;
    }
    moment.isTranslating = true;
    try {
      const res = await this.vocabStore.translateWordOrSentence(moment.text_content, 'en');
      moment.translatedText = res.translated_text;
    } catch (e) {
      console.error('Inline translation error:', e);
      moment.translatedText = 'Could not fetch translation right now.';
    } finally {
      moment.isTranslating = false;
    }
  }

  async toggleComments(moment: MomentRecord): Promise<void> {
    const map = new Set(this.openCommentsMap());
    if (map.has(moment.id)) {
      map.delete(moment.id);
      this.openCommentsMap.set(map);
    } else {
      map.add(moment.id);
      this.openCommentsMap.set(map);
      if (!moment.comments) {
        await this.momentsStore.loadComments(moment.id);
      }
    }
  }

  async submitComment(moment: MomentRecord): Promise<void> {
    const isCorrection = this.correctionModeMap[moment.id] ?? false;
    if (isCorrection) {
      const orig = this.correctionOriginalMap[moment.id]?.trim();
      const corr = this.correctionCorrectedMap[moment.id]?.trim();
      const exp = this.correctionExplanationMap[moment.id]?.trim();
      if (!orig || !corr) return;

      await this.momentsStore.addComment(moment.id, {
        correction_payload: {
          original: orig,
          corrected: corr,
          explanation: exp || undefined
        }
      });
      this.correctionOriginalMap[moment.id] = '';
      this.correctionCorrectedMap[moment.id] = '';
      this.correctionExplanationMap[moment.id] = '';
      this.correctionModeMap[moment.id] = false;
    } else {
      const text = this.commentInputMap[moment.id]?.trim();
      if (!text) return;

      await this.momentsStore.addComment(moment.id, {
        text_content: text
      });
      this.commentInputMap[moment.id] = '';
    }
  }
}
