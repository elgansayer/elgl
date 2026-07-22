import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CentrifugeService } from '../../services/centrifuge.service';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';
import { DoodlePadComponent } from '../doodle-pad/doodle-pad.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { TokenisedTextComponent } from '../tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../word-definition-modal/word-definition-modal.component';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    VisualDiffComponent,
    DoodlePadComponent,
    VoiceRecorderComponent,
    TokenisedTextComponent,
    WordDefinitionModalComponent
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

  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isTyping = signal<boolean>(false);
  readonly showDoodleModal = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);
  readonly showCorrectionForm = signal<boolean>(false);

  // Selected word token for LingQ definition modal
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string>('');

  roomId = 'global-exchange';
  searchQuery = '';
  textInput = '';

  // Correction fields
  originalText = '';
  correctedText = '';
  explanationText = '';

  private subscription: any = null;

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async params => {
      if (params['id']) {
        this.roomId = params['id'];
      }
      await this.loadMessages();
      await this.setupRealTime();
    });
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
    this.subscription = this.centrifugeService.subscribe(`chat:${this.roomId}`, (data: any) => {
      if (data.message) {
        this.messages.update(list => [...list, data.message]);
      } else if (data.typing) {
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
        text_content: '🎨 Visual explanation doodle'
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
        text_content: '🎙️ Voice note'
      });
      this.messages.update(list => list.some(m => m.id === sent.id) ? list : [...list, sent]);
    } catch (e) {
      console.error('Failed to send voice note:', e);
    }
  }

  async bookmark(msg: ChatMessage): Promise<void> {
    try {
      await this.chatService.addFavourite(msg.id, `Saved from room ${this.roomId}`);
      alert('Message bookmarked to Favourites!');
    } catch (e) {
      console.error('Failed to bookmark message:', e);
      alert('Already bookmarked or failed.');
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
      alert(`📚 Saved sentence to your LingQ SRS Learning Deck:\n"${msg.text_content}"`);
    } catch (e) {
      console.error('Failed to save sentence to LingQ deck:', e);
      alert('Failed to save sentence or already in your SRS deck.');
    }
  }

  onSearch(): void {
    void this.loadMessages();
  }
}
