import { showToast, showErrorToast } from '../../services/toast.service';
import { Component, inject, signal, computed, OnDestroy, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService, ChatMessage, ChatRoom, GroupMember } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { StickerPickerComponent } from '../sticker-picker/sticker-picker.component';
import { ChatSystemBubbleComponent } from '../chat-system-bubble/chat-system-bubble.component';
import { SafetyService } from '../../services/safety.service';
import { CulturalTipComponent } from '../cultural-tip/cultural-tip.component';
import { ReplyPreviewComponent } from '../../chat/threaded-reply/threaded-reply.component';

@Component({
  selector: 'app-chat-room',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
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
  ],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.scss'],
})
export class ChatRoomComponent implements OnDestroy {
  readonly centrifugeService = inject(CentrifugeService);
  private chatService = inject(ChatService);
  readonly authService = inject(AuthService);
  private userService = inject(UserService);
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);

  id = input.required<string>();

  constructor() {
    effect(() => {
      const roomId = this.id();
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

  readonly participants = signal<GroupMember[]>([]);
  readonly blockedUserIds = signal<string[]>([]);
  readonly partnerLanguage = signal<string | null>(null);
  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    return this.messages().filter((m) => !blocked.includes(m.sender_id));
  });

  // The message currently being replied to, shown as a preview above the composer.
  readonly replyingTo = signal<ChatMessage | null>(null);
  readonly highlightedMessageId = signal<string | null>(null);

  // Transliteration state: message id -> romaji/pinyin string
  readonly transliterations = signal<Record<string, string>>({});

  // Translation state: message id -> translated string
  readonly translations = signal<Record<string, string>>({});
  // Toggle state: message id -> boolean
  readonly showTranslation = signal<Record<string, boolean>>({});

  // Selected word token for LingQ definition modal
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');

  roomId = '';
  roomDetails: ChatRoom | null = null;
  searchQuery = '';
  textInput = '';

  // Admin fields
  newGroupName = '';
  newMemberId = '';
  memberToRemoveId = '';

  // Correction fields
  originalText = '';
  correctedText = '';
  explanationText = '';

  private subscription: unknown = null;

  private async initializeRoom(): Promise<void> {
    await this.loadRoomDetails();
    if (this.isLocked()) {
      // Hide the conversation until the user unlocks it (see toggleLock/unlockRoom).
      this.pendingUnlock.set(true);
      return;
    }
    await this.finishLoadingRoom();
  }

  private async finishLoadingRoom(): Promise<void> {
    await this.loadBlockedUsers();
    await this.loadMessages();
    await this.setupRealTime();
    await this.resolvePartnerLanguage();
  }

  /** Requests app unlock (biometric/PIN) before revealing a locked chat's messages. */
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

  /** Looks up the chat partner's native language so a short cultural etiquette tip can be shown. */
  async resolvePartnerLanguage(): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;
    try {
      const members = await this.chatService.getGroupMembers(this.roomId);
      const partner = members.find((m) => m.user_id !== currentUserId);
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
  }

  async loadMessages(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.chatService.getMessages(this.roomId, this.searchQuery);
      this.messages.set(data);
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
      const payload = data as { message?: ChatMessage; typing?: boolean } | null;
      if (payload?.message) {
        this.messages.update((list) => [...list, payload.message!]);
      } else if (payload?.typing) {
        this.isTyping.set(true);
        setTimeout(() => this.isTyping.set(false), 3000);
      }
    });
  }

  onWordClicked(event: { token: string; context: string }): void {
    this.activeWordToken.set(event.token);
    this.activeWordContext.set(event.context);
  }

  async sendTextMessage(): Promise<void> {
    if (!this.textInput.trim()) return;
    const text = this.textInput.trim();
    const replyToId = this.replyingTo()?.id;
    this.textInput = '';

    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text,
        reply_to_id: replyToId,
      });
      // Add locally if not duplicate
      this.messages.update((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
      this.replyingTo.set(null);
    } catch (e) {
      console.error('Failed to send text message:', e);
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
    } catch (e) {
      console.error('Failed to send correction:', e);
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

    // In a full implementation, this would call the NLP service.
    // For the UI implementation, we provide a mock transliteration.
    const mockTransliteration = msg.text_content
      .split(' ')
      .map((word) => word.toLowerCase() + '-romaji')
      .join(' ');

    this.transliterations.update((prev) => ({
      ...prev,
      [msg.id]: mockTransliteration,
    }));
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

    try {
      const targetLang = this.i18n.currentLang().split('-')[0] || 'en';
      const res = await this.chatService.translateText(msg.text_content, targetLang);
      this.translations.update((prev) => ({
        ...prev,
        [msg.id]: res.translated_text,
      }));
      this.showTranslation.update((prev) => ({ ...prev, [msg.id]: true }));
    } catch (e) {
      console.error('Failed to translate message:', e);
      showToast(this.i18n.translate('moments.transError') || 'Translation failed');
    }
  }

  onSearch(): void {
    void this.loadMessages();
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
        // Navigate to user profile
        break;
      case 'view_participants':
        void this.toggleParticipantDrawer();
        break;
      case 'clear_chat':
        // Clear chat history
        break;
      case 'block_user':
        // Block user
        break;
      case 'report_user':
        // Report user
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
    if (parent) {
      this.replyingTo.set(parent);
    }
  }

  cancelReply(): void {
    this.replyingTo.set(null);
  }

  openDoodlePreview(url: string): void {
    window.open(url, '_blank');
  }

  // Admin Actions
  async renameGroup(): Promise<void> {
    if (!this.newGroupName.trim()) return;
    try {
      await this.chatService.renameGroup(this.roomId, this.newGroupName.trim());
      if (this.roomDetails) {
        this.roomDetails.title = this.newGroupName.trim();
      }
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
      if (this.showParticipantDrawer()) {
        await this.loadParticipants();
      }
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
      if (this.showParticipantDrawer()) {
        await this.loadParticipants();
      }
    } catch (e) {
      console.error('Failed to remove member:', e);
      showToast('Failed to remove member');
    }
  }

  async playNextVoiceNote(currentMessageId: string): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (!profile || !profile.auto_play_voice_notes) return;

      const msgs = this.messages();
      const currentIndex = msgs.findIndex((m) => m.id === currentMessageId);
      if (currentIndex === -1) return;

      for (let i = currentIndex + 1; i < msgs.length; i++) {
        const nextMsg = msgs[i];
        if (nextMsg.message_type === 'voice' && nextMsg.media_url) {
          const audioElement = document.getElementById(`audio-${nextMsg.id}`) as HTMLAudioElement;
          if (audioElement) {
            audioElement.play().catch((e) => console.error('Auto-play failed:', e));
          }
          break;
        }
      }
    } catch (e) {
      console.error('Failed to auto-play next voice note:', e);
    }
  }
}
