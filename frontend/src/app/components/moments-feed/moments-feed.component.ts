import { showToast, notImplementedToast } from '../../services/toast.service';
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
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
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
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
  private readonly i18n = inject(I18nService);

  readonly isCreating = signal<boolean>(false);
  readonly showVoiceRecorder = signal<boolean>(false);
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');
  readonly openCommentsMap = signal<Set<string>>(new Set());
  readonly expandedMomentIds = signal<Set<string>>(new Set());

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
      showToast(this.i18n.translate('moments.maxMediaAlert'));
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
      showToast(this.i18n.translate('moments.publishError'));
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
      moment.translatedText = this.i18n.translate('moments.transError');
    } finally {
      moment.isTranslating = false;
    }
  }

  async saveMomentSentenceToLingq(moment: MomentRecord): Promise<void> {
    if (!moment.text_content) return;
    try {
      const trans = await this.vocabStore.translateWordOrSentence(moment.text_content, 'en');
      const created = await this.vocabStore.saveWord({
        word_token: moment.text_content,
        translation: trans?.translated_text || `Post: ${moment.text_content}`,
        original_context: `Moment by ${moment.author?.display_name || 'Community Member'}`,
        definition: 'Saved full social feed moment to LingQ Spaced Repetition deck.'
      });
      await this.vocabStore.updateSrsLevel(created.id, 1);
      showToast(this.i18n.translate('moments.savedLingqAlert', { text: moment.text_content }));
    } catch (e) {
      console.error('Failed to save moment text to LingQ deck:', e);
      showToast(this.i18n.translate('moments.saveErrorAlert'));
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

  isMomentLong(moment: MomentRecord): boolean {
    return Boolean(moment.text_content && moment.text_content.length > 140);
  }

  getMomentDisplayText(moment: MomentRecord): string {
    const text = moment.text_content || '';
    if (!this.isMomentLong(moment)) {
      return text;
    }
    if (this.expandedMomentIds().has(moment.id)) {
      return text;
    }
    return `${text.slice(0, 140)}...`;
  }

  toggleMomentExpansion(momentId: string): void {
    const next = new Set(this.expandedMomentIds());
    if (next.has(momentId)) {
      next.delete(momentId);
    } else {
      next.add(momentId);
    }
    this.expandedMomentIds.set(next);
  }

  async copyMomentText(moment: MomentRecord): Promise<void> {
    if (!moment.text_content) return;
    try {
      await navigator.clipboard.writeText(moment.text_content);
      showToast(this.i18n.translate('moments.copiedAlert'));
    } catch (error) {
      console.error('Failed to copy moment text:', error);
      showToast(this.i18n.translate('moments.copyErrorAlert'));
    }
  }
}
