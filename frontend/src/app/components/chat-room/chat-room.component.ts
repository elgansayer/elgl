import { showToast } from '../../services/toast.service';
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { SafetyService } from '../../services/safety.service';
import { firstValueFrom } from 'rxjs';

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
    LongPressContextMenuComponent
  ],
  templateUrl: './chat-room.component.html',
  styleUrls: ['./chat-room.component.scss']
})
export class ChatRoomComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  readonly centrifugeService = inject(CentrifugeService);
  private chatService = inject(ChatService);
  readonly authService = inject(AuthService);
  readonly vocabStore = inject(VocabularyStore);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isTyping = signal<boolean>(false);
  readonly showDoodleModal = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);
  readonly showCorrectionForm = signal<boolean>(false);
  readonly showSearch = signal<boolean>(false);

  readonly blockedUserIds = signal<string[]>([]);
  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    return this.messages().filter(m => !blocked.includes(m.sender_id));
  });

  // Transliteration state: message id -> romaji/pinyin string
  readonly transliterations = signal<Record<string, string>>({});

  // Selected word token for LingQ definition modal
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');

  roomId = '';
  searchQuery = '';
  textInput = '';

  // Correction fields
  originalText = '';
  correctedText = '';
  explanationText = '';

  private subscription: unknown = null;

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async params => {
      if (params['id']) {
        this.roomId = params['id'];
      }
      await this.loadBlockedUsers();
      await this.loadMessages();
      await this.setupRealTime();
    });
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
        this.messages.update(list => [...list, payload.message!]);
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
    this.textInput = '';

    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text
      });
      // Add locally if not duplicate
      this.messages.update(list => list.some(m => m.id === sent.id) ? list : [...list, sent]);
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
          explanation: this.explanationText.trim() || undefined
        }
      });
      this.messages.update(list => list.some(m => m.id === sent.id) ? list : [...list, sent]);
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
        text_content: this.i18n.translate('chatRoom.doodleCaption')
      });
      this.messages.update(list => list.some(m => m.id === sent.id) ? list : [...list, sent]);
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
        text_content: this.i18n.translate('chatRoom.voiceNoteCaption')
      });
      this.messages.update(list => list.some(m => m.id === sent.id) ? list : [...list, sent]);
    } catch (e) {
      console.error('Failed to send voice note:', e);
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

  async reportMessage(msg: ChatMessage): Promise<void> {
    try {
      await firstValueFrom(this.safetyService.reportUser({
        reported_id: msg.sender_id,
        reason_category: 'inappropriate_content',
        description: 'Inappropriate message content',
        context_url: `${window.location.origin}/chat/${this.roomId}`
      }));
      showToast(this.i18n.translate('chatRoom.reportedAlert'));
    } catch (e) {
      console.error('Failed to report message:', e);
      showToast(this.i18n.translate('chatRoom.reportErrorAlert'));
    }
  }

  onBlockToggle(event: { senderId: string; blocked: boolean }): void {
    if (event.blocked) {
      this.blockedUserIds.update(ids => [...ids, event.senderId]);
      showToast(this.i18n.translate('safety.blockedAlert') || 'User blocked');
    } else {
      this.blockedUserIds.update(ids => ids.filter(id => id !== event.senderId));
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
        definition: 'Saved full chat sentence to LingQ Spaced Repetition deck.'
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
      .map(word => word.toLowerCase() + '-romaji')
      .join(' ');

    this.transliterations.update(prev => ({
      ...prev,
      [msg.id]: mockTransliteration
    }));
  }

  onSearch(): void {
    void this.loadMessages();
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  handleHeaderAction(actionId: string): void {
    switch (actionId) {
      case 'view_profile':
        // Navigate to user profile
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

  sendCorrectionFromInput(correction: { original: string; corrected: string; explanation?: string }): void {
    this.originalText = correction.original;
    this.correctedText = correction.corrected;
    this.explanationText = correction.explanation || '';
    this.sendCorrection();
  }

  scrollToMessage(message: ChatMessage): void {
    const index = this.messages().findIndex(m => m.id === message.id);
    if (index >= 0) {
      // Scroll logic - could use ViewChild to scroll container
    }
  }

  openDoodlePreview(url: string): void {
    window.open(url, '_blank');
  }
}
