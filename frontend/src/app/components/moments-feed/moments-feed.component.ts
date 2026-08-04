import { showToast } from '../../services/toast.service';
import { Component, DestroyRef, inject, signal, computed, resource, effect, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore, MomentRecord, MomentComment } from '../../services/moments.store';
import { VocabularyStore } from '../../services/vocabulary.store';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';
import { CorrectionModalComponent } from '../correction-modal/correction-modal.component';
import { TextToSpeechComponent } from '../text-to-speech/text-to-speech.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';

@Component({
  selector: 'app-moments-feed',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    TokenisedTextComponent,
    WordDefinitionModalComponent,
    VisualDiffComponent,
    VoiceRecorderComponent,
    ScrollablePillsComponent,
    CorrectionModalComponent,
    LanguagePickerComponent,
    TextToSpeechComponent,
  ],
  templateUrl: './moments-feed.component.html',
  styleUrls: ['./moments-feed.component.scss'],
})
export class MomentsFeedComponent {
  private readonly MAX_IMAGES = 9;
  private readonly MAX_VOICE_SECONDS = 60;

  readonly momentsStore = inject(MomentsStore);
  readonly vocabStore = inject(VocabularyStore);
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly i18n = inject(I18nService);

  private readonly destroyRef = inject(DestroyRef);
  readonly pageSize = 15;
  readonly visibleCount = signal(15);

  constructor() {
    afterNextRender(() => {
      window.addEventListener('scroll', this.handleWindowScroll);
      this.destroyRef.onDestroy(() => window.removeEventListener('scroll', this.handleWindowScroll));
    });
  }

  readonly isCreating = signal<boolean>(false);
  readonly showVoiceRecorder = signal<boolean>(false);
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');
  readonly openCommentsMap = signal<Set<string>>(new Set());
  readonly expandedMomentIds = signal<Set<string>>(new Set());
  readonly activeCorrectionMomentId = signal<string | null>(null);
  readonly activeCorrectionOriginalText = signal<string>('');
  readonly activeLikedByMomentId = signal<string | null>(null);

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'All', label: this.i18n.translate('moments.tabAll') },
      { id: 'Classmates', label: this.i18n.translate('moments.tabClassmates') },
      { id: 'Following', label: this.i18n.translate('moments.tabFollowing') },
    ];
  });
  readonly showComposeForm = signal<boolean>(false);

  // New Moment form state
  readonly newText = signal('');
  readonly newMediaUrls = signal<string[]>([]);
  readonly newMediaType = signal<'none' | 'images' | 'audio'>('none');
  readonly newTargetLanguage = signal<string>('en');
  private newVoiceDurationSec: number | null = null;
  tempImageUrlInput = '';

  // New Comment / Correction form states per momentId
  commentInputMap: Record<string, string> = {};
  correctionModeMap: Record<string, boolean> = {};
  correctionOriginalMap: Record<string, string> = {};
  correctionCorrectedMap: Record<string, string> = {};
  correctionExplanationMap: Record<string, string> = {};

  readonly feedResource = resource({
    loader: () => this.momentsStore.loadFeed('All'),
  });

  readonly profileResource = resource({
    loader: () => this.userService.getMyProfile(),
  });

  readonly initEffect = effect(() => {
    const profile = this.profileResource.value();
    if (profile) {
      const preferredTarget = profile.target_languages?.[0];
      if (preferredTarget) {
        this.newTargetLanguage.set(preferredTarget);
      }
    }
  });

  onTargetLanguageSelected(code: string): void {
    this.newTargetLanguage.set(code);
  }

  getLanguageDisplayName(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
    } catch {
      return code;
    }
  }

  getLanguageFlag(code: string): string {
    return getLanguageFlag(code);
  }

  getTargetLanguageTitle(code: string): string {
    return this.i18n.translate('moments.targetLanguageBadge', {
      language: this.getLanguageDisplayName(code),
    });
  }

  async setFilter(filter: string): Promise<void> {
    this.visibleCount.set(this.pageSize);
    if (filter === 'All' || filter === 'Classmates' || filter === 'Following') {
      await this.momentsStore.loadFeed(filter);
    } else {
      await this.momentsStore.loadFeed('All');
    }
  }

  addTempImageUrl(): void {
    if (!this.tempImageUrlInput.trim()) return;
    if (this.newMediaUrls().length >= this.MAX_IMAGES) {
      showToast(this.i18n.translate('moments.maxMediaAlert'));
      return;
    }
    this.newMediaUrls.update(urls => [...urls, this.tempImageUrlInput.trim()]);
    this.newMediaType.set('images');
    this.tempImageUrlInput = '';
  }

  removeMedia(index: number): void {
    this.newMediaUrls.update(urls => {
      const copy = [...urls];
      copy.splice(index, 1);
      return copy;
    });
    if (this.newMediaUrls().length === 0) {
      this.newMediaType.set('none');
    }
  }

  onVoiceUploaded(payload: string | { url: string; durationSec?: number }): void {
    const url = typeof payload === 'string' ? payload : payload.url;
    const durationSec = typeof payload === 'string' ? undefined : payload.durationSec;
    if (!url || !url.trim()) return;
    if (durationSec !== undefined && durationSec > this.MAX_VOICE_SECONDS) {
      showToast(
        this.i18n.translate('moments.voiceTooLongAlert', {
          max: this.MAX_VOICE_SECONDS,
        }),
      );
      return;
    }
    this.newVoiceDurationSec = durationSec ?? null;
    this.newMediaUrls.set([url]);
    this.newMediaType.set('audio');
    this.showVoiceRecorder.set(false);
  }

  async submitMoment(): Promise<void> {
    if (!this.newText().trim() && this.newMediaUrls().length === 0) return;
    if (
      this.newMediaType() === 'audio' &&
      this.newVoiceDurationSec !== null &&
      this.newVoiceDurationSec > this.MAX_VOICE_SECONDS
    ) {
      showToast(
        this.i18n.translate('moments.voiceTooLongAlert', {
          max: this.MAX_VOICE_SECONDS,
        }),
      );
      return;
    }
    this.isCreating.set(true);
    try {
      await this.momentsStore.createMoment({
        text_content: this.newText().trim() || undefined,
        media_urls: this.newMediaUrls(),
        media_type: this.newMediaType(),
        target_language: this.newTargetLanguage(),
      });
      this.newText.set('');
      this.newMediaUrls.set([]);
      this.newMediaType.set('none');
      this.newVoiceDurationSec = null;
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
        original_context: `Moment by ${moment.author?.display_name || this.i18n.translate('common.unknownUser')}`,
        definition: 'Saved full social feed moment to LingQ Spaced Repetition deck.',
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

  // Comment reply state map
  replyingToMap: Record<
    string,
    { parentCommentId: string; replyToUserId: string; replyToName: string } | null
  > = {};

  startReply(momentId: string, comment: MomentComment): void {
    this.replyingToMap[momentId] = {
      parentCommentId: comment.id,
      replyToUserId: comment.user_id,
      replyToName: comment.author?.display_name || 'User',
    };
  }

  cancelReply(momentId: string): void {
    this.replyingToMap[momentId] = null;
  }

  async submitComment(moment: MomentRecord): Promise<void> {
    const isCorrection = this.correctionModeMap[moment.id] ?? false;
    if (isCorrection) {
      const orig = this.correctionOriginalMap[moment.id]?.trim();
      const corr = this.correctionCorrectedMap[moment.id]?.trim();
      const exp = this.correctionExplanationMap[moment.id]?.trim();
      if (!orig || !corr) return;

      const replyTo = this.replyingToMap[moment.id];
      await this.momentsStore.addComment(moment.id, {
        correction_payload: {
          original: orig,
          corrected: corr,
          explanation: exp || undefined,
        },
        parent_comment_id: replyTo?.parentCommentId,
        reply_to_user_id: replyTo?.replyToUserId,
      });
      this.correctionOriginalMap[moment.id] = '';
      this.correctionCorrectedMap[moment.id] = '';
      this.correctionExplanationMap[moment.id] = '';
      this.correctionModeMap[moment.id] = false;
      this.replyingToMap[moment.id] = null;
    } else {
      const text = this.commentInputMap[moment.id]?.trim();
      if (!text) return;

      const replyTo = this.replyingToMap[moment.id];
      await this.momentsStore.addComment(moment.id, {
        text_content: text,
        parent_comment_id: replyTo?.parentCommentId,
        reply_to_user_id: replyTo?.replyToUserId,
      });
      this.commentInputMap[moment.id] = '';
      this.replyingToMap[moment.id] = null;
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

  openGhostCorrection(moment: MomentRecord, textToCorrect?: string): void {
    this.activeCorrectionMomentId.set(moment.id);
    this.activeCorrectionOriginalText.set(textToCorrect || moment.text_content || '');
  }

  quoteTextToComment(moment: MomentRecord, text: string): void {
    const existing = this.commentInputMap[moment.id] || '';
    this.commentInputMap[moment.id] = `"> ${text}"\n` + existing;
    const map = new Set(this.openCommentsMap());
    map.add(moment.id);
    this.openCommentsMap.set(map);
    showToast(this.i18n.translate('moments.quotedTextAlert'));
  }

  async onCorrectionModalSubmitted(payload: {
    original: string;
    corrected: string;
    explanation?: string;
  }): Promise<void> {
    const momentId = this.activeCorrectionMomentId();
    if (!momentId) return;

    await this.momentsStore.addComment(momentId, {
      correction_payload: payload,
    });
    this.activeCorrectionMomentId.set(null);
    const map = new Set(this.openCommentsMap());
    map.add(momentId);
    this.openCommentsMap.set(map);
    showToast(this.i18n.translate('moments.correctionSentAlert'));
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

  openLikedBy(moment: MomentRecord): void {
    this.activeLikedByMomentId.set(moment.id);
  }

  closeLikedBy(): void {
    this.activeLikedByMomentId.set(null);
  }

  private handleWindowScroll = (): void => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    if (docHeight - scrollTop - winHeight < 200) {
      const total = this.momentsStore.feed().length;
      if (this.visibleCount() < total) {
        this.visibleCount.update(c => c + this.pageSize);
      }
    }
  };
}
