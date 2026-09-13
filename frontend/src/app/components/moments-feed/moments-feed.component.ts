import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { showToast } from '../../services/toast.service';
import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  resource,
  effect,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore, MomentRecord, MomentComment } from '../../services/moments.store';
import { VocabularyStore } from '../../services/vocabulary.store';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';
import { CorrectionModalComponent } from '../correction-modal/correction-modal.component';
import { TextToSpeechComponent } from '../text-to-speech/text-to-speech.component';
import { LikedByModalComponent } from '../liked-by-modal/liked-by-modal.component';
import { LightboxComponent } from '../lightbox/lightbox.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';
import { DraftService } from '../../services/draft.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

interface MentionSuggestion {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

@Component({
  selector: 'app-moments-feed',
  imports: [
    HlmTextarea,
    HlmInput,
    HlmButton,
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
    LikedByModalComponent,
    LightboxComponent,
    LanguagePickerComponent,
    TextToSpeechComponent,
    AppEmptyStateComponent,
  ],
  templateUrl: './moments-feed.component.html',
  styleUrls: ['./moments-feed.component.scss'],
})
export class MomentsFeedComponent {
  private readonly MAX_IMAGES = 9;
  private readonly MAX_VOICE_SECONDS = 60;

  // Lightbox state
  readonly lightboxImages = signal<string[]>([]);
  readonly lightboxInitialIndex = signal<number>(0);

  readonly momentsStore = inject(MomentsStore);
  readonly vocabStore = inject(VocabularyStore);
  readonly authService = inject(AuthService);
  private readonly safetyService = inject(SafetyService);
  private readonly userService = inject(UserService);
  private readonly i18n = inject(I18nService);
  private readonly draftService = inject(DraftService);
  private readonly translationCacheService = inject(TranslationCacheService);

  private readonly destroyRef = inject(DestroyRef);
  readonly pageSize = 15;
  readonly visibleCount = signal(15);

  // Mute word filter
  readonly mutedWords = this.safetyService.mutedWords;
  readonly showMutePanel = signal<boolean>(false);
  readonly newMuteWord = signal('');

  readonly feedToDisplay = computed(() => {
    const raw = this.momentsStore.feed();
    return this.safetyService.filterMomentsByMutedWords(raw);
  });

  readonly isFilteringByMutedWords = computed(() => {
    return (
      this.mutedWords().length > 0 && this.feedToDisplay().length < this.momentsStore.feed().length
    );
  });

  addMutedWord(): void {
    const word = this.newMuteWord().trim();
    if (!word) return;
    this.safetyService.addMutedWord(word);
    this.newMuteWord.set('');
  }

  removeMutedWord(word: string): void {
    this.safetyService.removeMutedWord(word);
  }

  constructor() {
    afterNextRender(() => {
      window.addEventListener('scroll', this.handleWindowScroll);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', this.handleWindowScroll);
        this.saveMomentDraft();
      });
      this.restoreMomentDraft();
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
  // Translation cache and visibility toggle (issue #447)
  readonly translationCache = signal<Record<string, string>>({});
  readonly showTranslationMap = signal<Record<string, boolean>>({});

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'All', label: this.i18n.translate('moments.tabAll') },
      { id: 'For You', label: this.i18n.translate('moments.tabForYou') },
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

  // @mention autocomplete state per momentId
  readonly mentionQueryMap = signal<Record<string, string | null>>({});
  readonly mentionSuggestionsMap = signal<Record<string, MentionSuggestion[]>>({});
  readonly mentionActiveIndexMap = signal<Record<string, number>>({});
  private mentionRangeStartMap: Record<string, number> = {};
  private mentionRangeEndMap: Record<string, number> = {};

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
    if (
      filter === 'All' ||
      filter === 'Classmates' ||
      filter === 'Following' ||
      filter === 'For You'
    ) {
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
    this.newMediaUrls.update((urls) => [...urls, this.tempImageUrlInput.trim()]);
    this.newMediaType.set('images');
    this.tempImageUrlInput = '';
  }

  removeMedia(index: number): void {
    this.newMediaUrls.update((urls) => {
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
    const text = this.newText().trim();
    if (!text && this.newMediaUrls().length === 0) return;
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
      if (text) {
        const grammar = await this.vocabStore.checkGrammar(text, this.newTargetLanguage());
        const corrected = grammar.corrected.trim();
        if (grammar.errors_found > 0 && corrected && corrected !== text) {
          this.newText.set(corrected);
          this.saveMomentDraft();
          showToast(grammar.explanation);
          return;
        }
      }

      await this.momentsStore.createMoment({
        text_content: text || undefined,
        media_urls: this.newMediaUrls(),
        media_type: this.newMediaType(),
        target_language: this.newTargetLanguage(),
      });
      this.newText.set('');
      this.newMediaUrls.set([]);
      this.newMediaType.set('none');
      this.newVoiceDurationSec = null;
      this.draftService.clearMomentDraft();
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

    const cacheKey = moment.id;
    const currentlyShowing = this.showTranslationMap()[cacheKey];

    // Toggle off: hide the translation but keep it cached
    if (currentlyShowing) {
      this.showTranslationMap.update((prev) => ({ ...prev, [cacheKey]: false }));
      return;
    }

    // Show cached translation if available (issue #447)
    if (this.translationCache()[cacheKey]) {
      this.showTranslationMap.update((prev) => ({ ...prev, [cacheKey]: true }));
      return;
    }

    // Check persistent translation cache (issue #1037)
    const persistentCached = this.translationCacheService.get(moment.text_content, 'en');
    if (persistentCached) {
      this.translationCache.update((prev) => ({ ...prev, [cacheKey]: persistentCached }));
      this.showTranslationMap.update((prev) => ({ ...prev, [cacheKey]: true }));
      return;
    }

    // Fetch from API and cache the result
    moment.isTranslating = true;
    try {
      const res = await this.vocabStore.translateWordOrSentence(moment.text_content, 'en');
      this.translationCacheService.set(moment.text_content, 'en', res.translated_text);
      this.translationCache.update((prev) => ({ ...prev, [cacheKey]: res.translated_text }));
      this.showTranslationMap.update((prev) => ({ ...prev, [cacheKey]: true }));
    } catch (e) {
      console.error('Inline translation error:', e);
      this.translationCache.update((prev) => ({
        ...prev,
        [cacheKey]: this.i18n.translate('moments.transError'),
      }));
      this.showTranslationMap.update((prev) => ({ ...prev, [cacheKey]: true }));
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
      await this.vocabStore.updateSrsLevel(created.id, 3);
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

  // --- @mention autocomplete for comment inputs ---

  onCommentInput(event: Event, momentId: string): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const cursor = target.selectionStart ?? target.value.length;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = /@([\wÀ-ɏ؀-ۿ]*)$/.exec(textBeforeCursor);
    if (match) {
      this.mentionRangeStartMap[momentId] = match.index;
      this.mentionRangeEndMap[momentId] = cursor;
      this.mentionQueryMap.update((m) => ({ ...m, [momentId]: match[1] }));
      this.mentionActiveIndexMap.update((m) => ({ ...m, [momentId]: 0 }));
      void this.loadMentionSuggestions(momentId);
    } else {
      this.mentionQueryMap.update((m) => ({ ...m, [momentId]: null }));
    }
  }

  onCommentKeydown(event: KeyboardEvent, moment: MomentRecord): void {
    const momentId = moment.id;
    const suggestions = this.mentionSuggestionsMap()[momentId] ?? [];
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.mentionActiveIndexMap.update((m) => ({
          ...m,
          [momentId]: Math.min((m[momentId] ?? 0) + 1, suggestions.length - 1),
        }));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.mentionActiveIndexMap.update((m) => ({
          ...m,
          [momentId]: Math.max((m[momentId] ?? 0) - 1, 0),
        }));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const idx = this.mentionActiveIndexMap()[momentId] ?? 0;
        this.selectMention(momentId, suggestions[idx]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.mentionQueryMap.update((m) => ({ ...m, [momentId]: null }));
        return;
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.submitComment(moment);
    }
  }

  private async loadMentionSuggestions(momentId: string): Promise<void> {
    const query = this.mentionQueryMap()[momentId];
    if (!query) {
      this.mentionSuggestionsMap.update((m) => ({ ...m, [momentId]: [] }));
      return;
    }
    try {
      const results = await this.userService.searchUsers(query, 5);
      this.mentionSuggestionsMap.update((m) => ({ ...m, [momentId]: results }));
    } catch {
      this.mentionSuggestionsMap.update((m) => ({ ...m, [momentId]: [] }));
    }
  }

  selectMention(momentId: string, member: MentionSuggestion | undefined): void {
    const displayName = member?.display_name;
    if (!displayName) return;
    const mentionText = '@' + displayName + ' ';
    this.commentInputMap[momentId] =
      (this.commentInputMap[momentId] ?? '').slice(0, this.mentionRangeStartMap[momentId]) +
      mentionText +
      (this.commentInputMap[momentId] ?? '').slice(this.mentionRangeEndMap[momentId]);
    this.mentionQueryMap.update((m) => ({ ...m, [momentId]: null }));
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

  async voteOnCorrection(
    momentId: string,
    comment: MomentComment,
    vote: 'up' | 'down',
  ): Promise<void> {
    try {
      await this.momentsStore.voteOnCorrection(momentId, comment.id, vote);
    } catch (error) {
      console.error('Failed to vote on correction:', error);
      showToast(this.i18n.translate('moments.voteErrorAlert'));
    }
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

  openLightbox(images: string[], index: number): void {
    this.lightboxImages.set(images);
    this.lightboxInitialIndex.set(index);
  }

  closeLightbox(): void {
    this.lightboxImages.set([]);
  }

  private handleWindowScroll = (): void => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    if (docHeight - scrollTop - winHeight < 200) {
      const total = this.feedToDisplay().length;
      if (this.visibleCount() < total) {
        this.visibleCount.update((c) => c + this.pageSize);
      }
    }
  };

  private saveMomentDraft(): void {
    this.draftService.saveMomentDraft({
      text: this.newText(),
      mediaUrls: this.newMediaUrls().length > 0 ? this.newMediaUrls() : undefined,
      mediaType: this.newMediaType(),
      targetLanguage: this.newTargetLanguage(),
      voiceDurationSec: this.newVoiceDurationSec,
    });
  }

  private restoreMomentDraft(): void {
    const draft = this.draftService.loadMomentDraft();
    if (!draft) return;
    if (draft.text) this.newText.set(draft.text);
    if (draft.mediaUrls && draft.mediaUrls.length > 0) {
      this.newMediaUrls.set(draft.mediaUrls);
      this.newMediaType.set(draft.mediaType ?? 'images');
    }
    if (draft.targetLanguage) this.newTargetLanguage.set(draft.targetLanguage);
    if (draft.voiceDurationSec !== undefined) this.newVoiceDurationSec = draft.voiceDurationSec;
  }
}
