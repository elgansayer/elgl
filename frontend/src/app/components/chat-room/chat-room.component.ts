import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButton } from '@spartan-ng/helm/button';
import { showToast, showErrorToast } from '../../services/toast.service';
import { Component, inject, signal, computed, OnDestroy, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService, ChatMessage, ChatRoom, GroupMember } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { TypingService } from '../../services/typing.service';
import { TypingIndicatorComponent } from '../primitives/typing-indicator/typing-indicator.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { StickerPickerComponent } from '../sticker-picker/sticker-picker.component';
import { ChatSystemBubbleComponent } from '../chat-system-bubble/chat-system-bubble.component';
import { SafetyService } from '../../services/safety.service';
import { TextToSpeechService } from '../../services/text-to-speech.service';
import { CulturalTipComponent } from '../cultural-tip/cultural-tip.component';
import { ReplyPreviewComponent } from '../../chat/threaded-reply/threaded-reply.component';
import { LinkPreviewCardComponent } from '../link-preview-card/link-preview-card.component';
import {
  GroupParticipantDrawerComponent,
  GroupParticipant,
} from '../group-participant-drawer/group-participant-drawer.component';
import { ChatSearchComponent } from '../chat-search/chat-search.component';
import { DraftService } from '../../services/draft.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-chat-room',
  imports: [
    HlmButton,
    ...HlmAutocompleteImports,
    CommonModule,
    TranslatePipe,
    TypingIndicatorComponent,
    VisualDiffComponent,
    DoodlePadComponent,
    VoiceRecorderComponent,
    TokenisedTextComponent,
    WordDefinitionModalComponent,
    LongPressContextMenuComponent,
    StickerPickerComponent,
    ChatSystemBubbleComponent,
    CulturalTipComponent,
    ReplyPreviewComponent,
    LinkPreviewCardComponent,
    GroupParticipantDrawerComponent,
    ChatSearchComponent,
    AppCardComponent,
    AppInputComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.scss'],
})
export class ChatRoomComponent implements OnDestroy {
  readonly centrifugeService = inject(CentrifugeService);
  private chatService = inject(ChatService);
  readonly authService = inject(AuthService);
  private userService = inject(UserService);
  readonly typingService = inject(TypingService);
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);
  private readonly tts = inject(TextToSpeechService);
  private readonly draftService = inject(DraftService);
  private readonly translationCache = inject(TranslationCacheService);

  id = input.required<string>();

  constructor() {
    effect(() => {
      const roomId = this.id();
      // Save draft for the previous room before switching
      if (this.roomId && this.roomId !== roomId) {
        this.saveChatDrafts();
      }
      this.roomId = roomId;
      void this.initializeRoom();
    });
  }

  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isTyping = signal<boolean>(false);
  readonly showDoodleModal = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);
  readonly showCorrectionForm = signal<boolean>(false);
  readonly showStickerDrawer = signal<boolean>(false);
  readonly showSearch = signal<boolean>(false);
  readonly showAdminPanel = signal<boolean>(false);
  readonly showParticipantDrawer = signal<boolean>(false);
  readonly isLocked = signal<boolean>(false);
  readonly pendingUnlock = signal<boolean>(false);
  readonly autoPlayVoiceNotes = signal(false);

  readonly participants = signal<GroupMember[]>([]);
  readonly groupParticipants = computed<GroupParticipant[]>(() =>
    this.participants().map((m) => ({
      id: m.user_id,
      display_name: m.user?.display_name ?? `User ${m.user_id.slice(0, 6)}`,
      avatar_url: m.user?.avatar_url ?? undefined,
      native_language: m.user?.native_language ?? '',
      target_languages: m.user?.target_languages ?? [],
      is_vip: m.user?.is_vip ?? false,
    })),
  );
  readonly blockedUserIds = signal<string[]>([]);
  readonly partnerLanguage = signal<string | null>(null);
  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    return this.messages().filter((m) => !blocked.includes(m.sender_id));
  });

  readonly replyingTo = signal<ChatMessage | null>(null);
  readonly highlightedMessageId = signal<string | null>(null);
  readonly transliterations = signal<Record<string, string>>({});
  readonly translations = signal<Record<string, string>>({});
  readonly showTranslation = signal<Record<string, boolean>>({});
  readonly transcriptions = signal<Record<string, string>>({});
  readonly transcribingIds = signal<Set<string>>(new Set());
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');

  // @mention filtering stays product-specific. Keyboard/listbox ownership lives in Spartan.
  readonly mentionQuery = signal<string | null>(null);
  readonly mentionSuggestions = computed<GroupMember[]>(() => {
    const query = this.mentionQuery();
    if (query === null) return [];
    const currentUserId = this.authService.currentUser()?.id;
    const lowerQuery = query.toLowerCase();
    return this.participants()
      .filter(
        (member) =>
          member.user_id !== currentUserId &&
          (member.user?.display_name ?? '').toLowerCase().startsWith(lowerQuery),
      )
      .slice(0, 5);
  });
  private mentionRangeStart = 0;
  private mentionRangeEnd = 0;

  readonly mentionItemToString = (value: unknown): string => {
    if (!value || typeof value !== 'object' || !('user_id' in value)) return this.textInput;
    const member = value as GroupMember;
    const displayName = member.user?.display_name;
    if (!displayName) return this.textInput;
    return (
      this.textInput.slice(0, this.mentionRangeStart) +
      `@${displayName} ` +
      this.textInput.slice(this.mentionRangeEnd)
    );
  };

  roomId = '';
  roomDetails: ChatRoom | null = null;
  searchQuery = '';
  showSearchPanel = signal(false);
  textInput = '';

  newGroupName = '';
  newMemberId = '';
  memberToRemoveId = '';

  originalText = '';
  correctedText = '';
  explanationText = '';

  private subscription: { unsubscribe: () => void } | null = null;

  private isChatEventPayload(value: unknown): value is { message?: ChatMessage; typing?: boolean } {
    return !!value && typeof value === 'object' && ('message' in value || 'typing' in value);
  }

  private async initializeRoom(): Promise<void> {
    await this.loadRoomDetails();
    if (this.isLocked()) {
      this.pendingUnlock.set(true);
      return;
    }
    await this.finishLoadingRoom();
  }

  private async finishLoadingRoom(): Promise<void> {
    await this.loadBlockedUsers();
    await this.loadMessages();
    this.restoreDraft();
    await this.setupRealTime();
    await this.loadParticipants();
    await this.resolvePartnerLanguage();
    await this.loadAutoPlayPreference();
  }

  private async loadAutoPlayPreference(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      this.autoPlayVoiceNotes.set(Boolean(profile?.auto_play_voice_notes));
    } catch {
      // keep default false
    }
  }

  async unlockRoom(): Promise<void> {
    await this.authService.unlockApp();
    if (!this.authService.appLocked()) {
      this.pendingUnlock.set(false);
      await this.finishLoadingRoom();
    }
  }

  async toggleLock(): Promise<void> {
    if (!this.roomId) return;
    try {
      if (this.isLocked()) {
        await this.chatService.unlockChat(this.roomId);
        this.isLocked.set(false);
        if (this.roomDetails) this.roomDetails.is_locked = false;
        showToast(this.i18n.translate('chatList.chatUnlocked'), 'success');
      } else {
        await this.chatService.lockChat(this.roomId);
        this.isLocked.set(true);
        if (this.roomDetails) this.roomDetails.is_locked = true;
        showToast(this.i18n.translate('chatList.chatLocked'), 'success');
      }
    } catch (e) {
      console.error('Failed to update chat lock status:', e);
      showErrorToast(this.i18n.translate('chatList.lockActionFailed'));
    }
  }

  async resolvePartnerLanguage(): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;
    try {
      const partner = this.participants().find((m) => m.user_id !== currentUserId);
      if (!partner) return;
      const profile = await this.userService.getUserProfile(partner.user_id);
      this.partnerLanguage.set(profile?.native_languages?.[0] ?? null);
    } catch (e) {
      console.error('Failed to resolve partner language:', e);
    }
  }

  async loadRoomDetails(): Promise<void> {
    try {
      const rooms = await this.chatService.getRooms();
      this.roomDetails = rooms.find((r) => r.id === this.roomId) || null;
      this.isLocked.set(this.roomDetails?.is_locked ?? false);
    } catch (e) {
      console.error('Failed to load room details:', e);
    }
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg.sender_id === this.authService.currentUser()?.id;
  }

  get isAdmin(): boolean {
    const currentUser = this.authService.currentUser();
    return !!(currentUser && this.roomDetails && this.roomDetails.admin_id === currentUser.id);
  }

  async loadBlockedUsers(): Promise<void> {
    try {
      const ids = await this.safetyService.getBlockedIdsAsync();
      this.blockedUserIds.set(ids);
    } catch (e) {
      console.error('Failed to load blocked users:', e);
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.centrifugeService.unsubscribe(`chat:${this.roomId}`);
    }
    this.typingService.disconnect();
    this.saveChatDrafts();
  }

  saveChatDrafts(): void {
    this.draftService.saveChatDraft(this.roomId, this.textInput);
    this.draftService.saveChatDraftV2(this.roomId, {
      textInput: this.textInput,
      replyToId: this.replyingTo()?.id ?? null,
      originalText: this.originalText,
      correctedText: this.correctedText,
      explanationText: this.explanationText,
    });
  }

  private restoreDraft(): void {
    const simpleDraft = this.draftService.loadChatDraft(this.roomId);
    if (simpleDraft) this.textInput = simpleDraft;

    const v2Draft = this.draftService.loadChatDraftV2(this.roomId);
    if (v2Draft) {
      if (v2Draft.textInput) this.textInput = v2Draft.textInput;
      if (v2Draft.originalText) this.originalText = v2Draft.originalText;
      if (v2Draft.correctedText) this.correctedText = v2Draft.correctedText;
      if (v2Draft.explanationText) this.explanationText = v2Draft.explanationText;
      if (v2Draft.replyToId) this._restoredReplyToId = v2Draft.replyToId;
    }
  }

  private clearChatDrafts(): void {
    this.draftService.clearChatDraft(this.roomId);
    this.draftService.clearChatDraftV2(this.roomId);
  }

  private _restoredReplyToId: string | null = null;

  async loadMessages(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.chatService.getMessages(this.roomId, this.searchQuery);
      this.messages.set(data);
      if (this._restoredReplyToId) {
        const target = data.find((m) => m.id === this._restoredReplyToId);
        if (target) this.replyingTo.set(target);
        this._restoredReplyToId = null;
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async setupRealTime(): Promise<void> {
    await this.centrifugeService.connect();
    if (this.subscription) {
      this.centrifugeService.unsubscribe(`chat:${this.roomId}`);
    }
    this.subscription = this.centrifugeService.subscribe(`chat:${this.roomId}`, (data: unknown) => {
      const payload = this.isChatEventPayload(data) ? data : null;
      if (payload?.message) {
        this.messages.update((list) => [...list, payload.message!]);
      } else if (payload?.typing) {
        this.isTyping.set(true);
        setTimeout(() => this.isTyping.set(false), 3000);
      }
    });
    this.typingService.connect(this.roomId);
  }

  onWordClicked(event: { token: string; context: string }): void {
    this.activeWordToken.set(event.token);
    this.activeWordContext.set(event.context);
  }

  onComposerInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const cursor = target.selectionStart ?? target.value.length;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = /@([\wÀ-ɏ؀-ۿ]*)$/.exec(textBeforeCursor);
    if (match) {
      this.mentionRangeStart = match.index;
      this.mentionRangeEnd = cursor;
      this.mentionQuery.set(match[1]);
    } else {
      this.mentionQuery.set(null);
    }
    this.typingService.sendTyping(target.value.length > 0);
    this.saveChatDrafts();
  }

  onComposerKeydown(event: KeyboardEvent): void {
    // Spartan owns ArrowUp/ArrowDown/Escape/selection while the autocomplete is open.
    if (event.key === 'Enter' && this.mentionSuggestions().length === 0) {
      event.preventDefault();
      this.sendTextMessage();
    }
  }

  onMentionSelected(member: unknown): void {
    if (!member) return;
    this.mentionQuery.set(null);
    this.saveChatDrafts();
  }

  async sendTextMessage(): Promise<void> {
    if (!this.textInput.trim()) return;
    const text = this.textInput.trim();
    const replyToId = this.replyingTo()?.id;
    this.mentionQuery.set(null);
    this.typingService.sendTyping(false);

    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text,
        reply_to_id: replyToId,
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      this.replyingTo.set(null);
      this.textInput = '';
      this.clearChatDrafts();
    } catch (e) {
      console.error('Failed to send text message:', e);
      this.draftService.saveChatDraft(this.roomId, text);
    }
  }

  async sendCorrection(): Promise<void> {
    if (!this.originalText.trim() || !this.correctedText.trim()) return;
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'correction',
        correction_payload: {
          original: this.originalText.trim(),
          corrected: this.correctedText.trim(),
          explanation: this.explanationText.trim() || undefined,
        },
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      this.originalText = '';
      this.correctedText = '';
      this.explanationText = '';
      this.showCorrectionForm.set(false);
      this.clearChatDrafts();
    } catch (e) {
      console.error('Failed to send correction:', e);
    }
  }

  async requestCorrection(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'correction_request',
        correction_request_payload: { original_text: msg.text_content },
        reply_to_id: msg.id,
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to request correction:', e);
    }
  }

  async onDoodleSaved(dataUrl: string): Promise<void> {
    this.showDoodleModal.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'doodle',
        media_url: dataUrl,
        text_content: this.i18n.translate('chatRoom.doodleCaption'),
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send doodle:', e);
    }
  }

  async onVoiceUploaded(mediaUrl: string): Promise<void> {
    this.showVoiceModal.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'voice',
        media_url: mediaUrl,
        text_content: this.i18n.translate('chatRoom.voiceNoteCaption'),
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send voice note:', e);
    }
  }

  async sendSticker(stickerUrl: string): Promise<void> {
    this.showStickerDrawer.set(false);
    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'sticker',
        media_url: stickerUrl,
        text_content: this.i18n.translate('chatRoom.stickerCaption') || 'Sticker',
      });
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      console.error('Failed to send sticker:', e);
    }
  }

  async bookmark(msg: ChatMessage): Promise<void> {
    try {
      await this.chatService.addFavourite(msg.id, `Saved from room ${this.roomId}`);
      showToast(this.i18n.translate('chatRoom.bookmarkedAlert'));
    } catch (e) {
      console.error('Failed to bookmark message:', e);
      showToast(this.i18n.translate('chatRoom.bookmarkErrorAlert'));
    }
  }

  startCorrection(msg: ChatMessage): void {
    if (msg.message_type !== 'text') return;
    this.originalText = msg.text_content ?? '';
    this.correctedText = '';
    this.explanationText = '';
    this.showCorrectionForm.set(true);
  }

  onBlockToggle(event: { senderId: string; blocked: boolean }): void {
    if (event.blocked) {
      this.blockedUserIds.update((ids) => [...ids, event.senderId]);
      showToast(this.i18n.translate('safety.blockedAlert') || 'User blocked');
    } else {
      this.blockedUserIds.update((ids) => ids.filter((id) => id !== event.senderId));
      showToast(this.i18n.translate('safety.unblockedAlert') || 'User unblocked');
    }
  }

  async saveSentenceToLingq(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const trans = await this.vocabStore.translateWordOrSentence(msg.text_content, 'en');
      const created = await this.vocabStore.saveWord({
        word_token: msg.text_content,
        translation: trans?.translated_text || `Sentence: ${msg.text_content}`,
        original_context: `Chat room: ${this.roomId}`,
        definition: 'Saved full chat sentence to LingQ Spaced Repetition deck.',
      });
      await this.vocabStore.updateSrsLevel(created.id, 1);
      showToast(this.i18n.translate('chatRoom.savedLingqAlert', { text: msg.text_content }));
    } catch (e) {
      console.error('Failed to save sentence to LingQ deck:', e);
      showToast(this.i18n.translate('chatRoom.saveErrorAlert'));
    }
  }

  async transliterateMessage(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;
    try {
      const result = await this.vocabStore.translateWordOrSentence(msg.text_content, 'en');
      this.transliterations.update((prev) => ({
        ...prev,
        [msg.id]: result.transliteration || result.translated_text,
      }));
    } catch (e) {
      console.error('Failed to transliterate message:', e);
      showToast(this.i18n.translate('moments.transError') || 'Transliteration failed');
    }
  }

  speakMessage(msg: ChatMessage): void {
    if (!msg.text_content?.trim()) return;
    this.tts.speak(msg.id, msg.text_content);
  }

  async toggleTranslation(msg: ChatMessage): Promise<void> {
    if (!msg.text_content) return;

    const currentShow = this.showTranslation()[msg.id];
    if (currentShow) {
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: false }));
      return;
    }

    if (this.translations()[msg.id]) {
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
      return;
    }

    const targetLang = this.i18n.currentLang().split('-')[0] || 'en';
    const cached = this.translationCache.get(msg.text_content, targetLang);
    if (cached) {
      this.translations.update((prev) => ({ ...prev, [msg.id]: cached }));
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
      return;
    }

    try {
      const res = await this.chatService.translateText(msg.text_content, targetLang);
      this.translationCache.set(msg.text_content, targetLang, res.translated_text);
      this.translations.update((prev) => ({ ...prev, [msg.id]: res.translated_text }));
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
    } catch (e) {
      console.error('Failed to translate message:', e);
      showToast(this.i18n.translate('moments.transError') || 'Translation failed');
    }
  }

  async onTranscribeVoice(msg: ChatMessage): Promise<void> {
    if (!msg.media_url || this.transcriptions()[msg.id]) return;
    this.transcribingIds.update((s) => {
      const next = new Set(s);
      next.add(msg.id);
      return next;
    });

    try {
      const result = await this.chatService.transcribeVoice(msg.media_url);
      this.transcriptions.update((prev) => ({
        ...prev,
        [msg.id]: result.original_text || this.i18n.translate('chatRoom.transcriptEmpty'),
      }));
    } catch (e) {
      console.error('Failed to transcribe voice message:', e);
      showToast(this.i18n.translate('chatRoom.transcribeError'));
    } finally {
      this.transcribingIds.update((s) => {
        const next = new Set(s);
        next.delete(msg.id);
        return next;
      });
    }
  }

  onSearch(): void {
    void this.loadMessages();
  }

  onSearchResultSelect(message: ChatMessage): void {
    this.showSearchPanel.set(false);
    if (message.room_id === this.roomId) this.scrollToMessage(message.id);
  }

  async toggleParticipantDrawer(): Promise<void> {
    this.showParticipantDrawer.update((v) => !v);
    if (this.showParticipantDrawer() && this.participants().length === 0) {
      await this.loadParticipants();
    }
  }

  async loadParticipants(): Promise<void> {
    try {
      const members = await this.chatService.getGroupMembers(this.roomId);
      this.participants.set(members);
    } catch (e) {
      console.error('Failed to load participants:', e);
    }
  }

  handleHeaderAction(actionId: string): void {
    switch (actionId) {
      case 'view_profile':
        break;
      case 'view_participants':
        void this.toggleParticipantDrawer();
        break;
      case 'clear_chat':
        break;
      case 'block_user':
        break;
      case 'report_user':
        break;
    }
  }

  sendCorrectionFromInput(correction: {
    original: string;
    corrected: string;
    explanation?: string;
  }): void {
    this.originalText = correction.original;
    this.correctedText = correction.corrected;
    this.explanationText = correction.explanation || '';
    this.sendCorrection();
  }

  scrollToMessage(messageId: string): void {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.highlightedMessageId.set(messageId);
    setTimeout(() => this.highlightedMessageId.set(null), 1500);
  }

  parentMessageFor(msg: ChatMessage): ChatMessage | undefined {
    if (!msg.reply_to_id) return undefined;
    return this.messages().find((m) => m.id === msg.reply_to_id);
  }

  startReply(messageId: string): void {
    const parent = this.messages().find((m) => m.id === messageId);
    if (parent) this.replyingTo.set(parent);
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  openDoodlePreview(url: string): void {
    window.open(url, '_blank');
  }

  async renameGroup(): Promise<void> {
    if (!this.newGroupName.trim()) return;
    try {
      await this.chatService.renameGroup(this.roomId, this.newGroupName.trim());
      if (this.roomDetails) this.roomDetails.title = this.newGroupName.trim();
      this.newGroupName = '';
      showToast('Group renamed successfully');
    } catch (e) {
      console.error('Failed to rename group:', e);
      showToast('Failed to rename group');
    }
  }

  async addMember(): Promise<void> {
    if (!this.newMemberId.trim()) return;
    try {
      await this.chatService.addGroupMembers(this.roomId, [this.newMemberId.trim()]);
      this.newMemberId = '';
      showToast('Member added successfully');
      if (this.showParticipantDrawer()) await this.loadParticipants();
    } catch (e) {
      console.error('Failed to add member:', e);
      showToast('Failed to add member');
    }
  }

  async removeMember(): Promise<void> {
    if (!this.memberToRemoveId.trim()) return;
    try {
      await this.chatService.removeGroupMember(this.roomId, this.memberToRemoveId.trim());
      this.memberToRemoveId = '';
      showToast('Member removed successfully');
      if (this.showParticipantDrawer()) await this.loadParticipants();
    } catch (e) {
      console.error('Failed to remove member:', e);
      showToast('Failed to remove member');
    }
  }

  async playNextVoiceNote(currentMessageId: string): Promise<void> {
    if (!this.autoPlayVoiceNotes()) return;
    const msgs = this.messages();
    const currentIndex = msgs.findIndex((m) => m.id === currentMessageId);
    if (currentIndex === -1) return;

    for (let i = currentIndex + 1; i < msgs.length; i++) {
      const nextMsg = msgs[i];
      if (nextMsg.message_type === 'voice' && nextMsg.media_url) {
        const audioElement = document.getElementById(`audio-${nextMsg.id}`);
        if (audioElement instanceof HTMLAudioElement) {
          audioElement.play().catch(() => {});
        }
        break;
      }
    }
  }
}
