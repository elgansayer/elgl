import { Component, input, output, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { LongPressContextMenuComponent } from '../long-press-context-menu/long-press-context-menu.component';
import { FavouriteService } from '../../services/favourite.service';
import { SafetyService } from '../../services/safety.service';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CulturalTipComponent } from '../cultural-tip/cultural-tip.component';
import { LinkPreviewCardComponent } from '../link-preview-card/link-preview-card.component';
import { FlashcardService } from '../../services/flashcard.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat-message',
  imports: [CommonModule, LongPressContextMenuComponent, TranslatePipe, CulturalTipComponent, LinkPreviewCardComponent],
  template: `
    @if (!isBlocked()) {
      @if (isFirstMessage() && partnerLanguage(); as lang) {
        <app-cultural-tip [language]="lang" />
      }
      <app-long-press-context-menu
        [messageId]="message().id"
        [messageContent]="message().text_content ?? ''"
        [messageType]="message().message_type"
        [senderId]="message().sender_id"
        [roomId]="message().room_id"
        [isBlocked]="isBlocked()"
        (copyMessage)="onCopy($event)"
        (favourite)="onFavourite($event)"
        (report)="onReport($event)"
        (block)="onBlockToggle($event)"
        (createFlashcard)="onCreateFlashcard($event)"
      >
        <div
          class="flex"
          [class.justify-end]="isOwnMessage()"
          [class.justify-start]="!isOwnMessage()"
        >
          <div
            class="relative max-w-[70%] p-3 rounded-ss-lg rounded-se-lg"
            [class.rounded-es-lg]="isOwnMessage()"
            [class.rounded-ee-none]="isOwnMessage()"
            [class.rounded-ee-lg]="!isOwnMessage()"
            [class.rounded-es-none]="!isOwnMessage()"
            [class.bg-blue-600]="isOwnMessage()"
            [class.text-white]="isOwnMessage()"
            [class.bg-surface-300]="!isOwnMessage()"
          >
            <span
              class="chat-bubble-tail"
              [class.chat-bubble-tail--sent]="isOwnMessage()"
              [class.chat-bubble-tail--received]="!isOwnMessage()"
              aria-hidden="true"
            ></span>
            @if (message().message_type === 'text') {
              <p class="text-sm">
                @for (segment of textSegments(); track $index) {
                  @if (segment.isMention) {
                    <span class="font-bold text-blue-400 cursor-pointer">{{ segment.value }}</span>
                  } @else {
                    {{ segment.value }}
                  }
                }
              </p>
              @if (message().link_preview; as lp) {
                <app-link-preview-card
                  [url]="lp.url"
                  [title]="lp.title"
                  [description]="lp.description"
                  [image]="lp.image"
                  [siteName]="lp.siteName"
                ></app-link-preview-card>
              }
              <button
                (click)="simplifyText()"
                class="text-xs text-blue-400 ms-2 mt-1"
                [disabled]="simplifying()"
              >
                @if (simplifying()) {
                  {{ 'chatRoom.simplifying' | t }}
                } @else {
                  {{ 'chatRoom.simplifyBtn' | t }}
                }
              </button>
            }
            @if (simplifiedText(); as simplified) {
              <div class="mt-1 ps-4 border-s-2 border-green-500 text-xs text-green-300">
                <p>{{ 'chatRoom.simplifiedTitle' | t }}</p>
                <p>{{ simplified }}</p>
                <button (click)="simplifiedText.set(null)" class="text-red-400 text-xs ms-1">
                  {{ 'common.close' | t }}
                </button>
              </div>
            }

            @if (message().message_type === 'voice') {
              <div class="flex items-center gap-2">
                <button aria-label="Play voice message" (click)="playVoice()" class="p-2 rounded-full hover:bg-black/10">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                    />
                  </svg>
                </button>
                <span class="text-sm">{{ 'chatRoom.voiceMessage' | t }}</span>
              </div>
              @if (message().media_url) {
                <div class="mt-2 text-xs opacity-80 italic border-s-2 border-blue-400 ps-2">
                  @if (voiceTranscribing()) {
                    <span>{{ 'chatRoom.transcribing' | t }}</span>
                  } @else if (voiceTranscription()) {
                    <span>{{ voiceTranscription() }}</span>
                  }
                </div>
              }
            }

            @if (message().message_type === 'correction' && message().correction_payload) {
              <div class="space-y-1">
                <p class="text-sm line-through opacity-75">
                  {{ message().correction_payload!.original }}
                </p>
                <p class="text-sm font-medium">{{ message().correction_payload!.corrected }}</p>
                @if (message().correction_payload!.explanation) {
                  <p class="text-xs opacity-75 mt-1">
                    {{ message().correction_payload!.explanation }}
                  </p>
                }
              </div>
            }

            @if (message().message_type === 'doodle' && message().media_url) {
              <img
                [src]="message().media_url"
                class="max-w-full rounded"
                alt="Doodle"
                loading="lazy"
              />
            }

            <p class="text-xs mt-1 opacity-60 text-end flex items-center justify-end gap-1">
              {{ message().created_at | date: 'shortTime' }}
              @if (isOwnMessage() && (message().delivery_status || message().is_read)) {
                <span class="inline-flex items-center">
                  @if (message().delivery_status === 'sent' || (!message().delivery_status && message().is_read)) {
                    <!-- Single check: sent -->
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                  @if (message().delivery_status === 'delivered') {
                    <!-- Double check: delivered (gray) -->
                    <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <svg class="w-3.5 h-3.5 -ms-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                  @if (message().delivery_status === 'read') {
                    <!-- Double check: read (blue) -->
                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <svg class="w-3.5 h-3.5 -ms-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </span>
              }
            </p>
          </div>
        </div>
      </app-long-press-context-menu>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .chat-bubble-tail {
        position: absolute;
        bottom: 0;
        width: 0.4rem;
        height: 0.4rem;
        background-color: inherit;
      }

      .chat-bubble-tail--sent {
        inset-inline-end: -0.3rem;
        clip-path: polygon(0 0, 100% 100%, 0 100%);
      }

      .chat-bubble-tail--received {
        inset-inline-start: -0.3rem;
        clip-path: polygon(100% 0, 100% 100%, 0 100%);
      }

      :dir(rtl) .chat-bubble-tail--sent,
      :dir(rtl) .chat-bubble-tail--received {
        transform: scaleX(-1);
      }
    `,
  ],
})
export class ChatMessageComponent {
  message = input.required<ChatMessage>();
  currentUserId = input<string>();
  partnerLanguage = input<string | null>(null);
  isFirstMessage = input(false);

  readonly messageBlocked = output<string>();

  private authService = inject(AuthService);
  private favouriteService = inject(FavouriteService);
  private safetyService = inject(SafetyService);
  private confirmService = inject(ConfirmService);
  private i18n = inject(I18nService);
  private flashcardService = inject(FlashcardService);

  isBlocked = signal(false);
  simplifiedText = signal<string | null>(null);
  simplifying = signal(false);
  voiceTranscription = signal<string | null>(null);
  voiceTranscribing = signal(false);

  textSegments = computed(() => {
    const text = this.message()?.text_content ?? '';
    const regex = /@([\w\u0641-\u06FF\u0600-\u06FF\u2013]|[\u00C0-\u024F])+/g;
    const parts: { isMention: boolean; value: string }[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ isMention: false, value: text.slice(lastIndex, match.index) });
      }
      parts.push({ isMention: true, value: match[0] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ isMention: false, value: text.slice(lastIndex) });
    }
    return parts;
  });

  constructor() {
    effect(() => {
      const senderId = this.message().sender_id;
      const blockedIds = this.safetyService.blockedUserIdsSignal();
      const currentlyBlocked = blockedIds.has(senderId);
      this.isBlocked.set(currentlyBlocked);
      if (currentlyBlocked) {
        this.messageBlocked.emit(senderId);
      }
    });

    effect(() => {
      const msg = this.message();
      if (msg.message_type === 'voice' && msg.media_url && !this.voiceTranscribing() && !this.voiceTranscription()) {
        void this.fetchTranscription(msg.media_url);
      }
    });
  }

  isOwnMessage(): boolean {
    if (this.currentUserId() != null) {
      return this.message().sender_id === this.currentUserId();
    }
    return this.message().sender_id === this.authService.currentUser()?.id;
  }

  playVoice(): void {
    if (this.message().media_url) {
      const audio = new Audio(this.message().media_url);
      audio.play().catch(console.error);
    }
  }

  async fetchTranscription(audioUrl: string): Promise<void> {
    this.voiceTranscribing.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/nlp/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: audioUrl }),
      });
      if (!res.ok) {
        throw new Error('Transcription request failed');
      }
      const data = await res.json();
      this.voiceTranscription.set(data.transcription || null);
    } catch (err) {
      console.error('Transcription error:', err);
      this.voiceTranscription.set(null);
    } finally {
      this.voiceTranscribing.set(false);
    }
  }

  async simplifyText(): Promise<void> {
    if (this.simplifying() || this.message().message_type !== 'text') return;
    const text = this.message().text_content ?? '';
    if (!text) return;
    this.simplifying.set(true);
    this.simplifiedText.set(null);
    try {
      const res = await fetch(`${environment.apiUrl}/nlp/simplify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error('Simplify request failed');
      }
      const data = await res.json();
      this.simplifiedText.set(data.simplified);
    } catch (err) {
      console.error('Simplify error:', err);
    } finally {
      this.simplifying.set(false);
    }
  }

  onCopy(event: { messageId: string; content: string }): void {
    navigator.clipboard.writeText(event.content).catch(console.error);
  }

  onFavourite(event: { messageId: string; content: string; messageType: string }): void {
    this.favouriteService.addFavourite({ message_id: event.messageId }).catch(() => {});
  }

  async onCreateFlashcard(event: { messageId: string; content: string }): Promise<void> {
    try {
      await this.flashcardService.createFlashcard({
        word: event.content,
        sourceLanguage: 'en',
        contextSentence: event.content,
      });
    } catch (err) {
      console.error('Failed to create flashcard:', err);
    }
  }

  onBlockToggle(event: { senderId: string; blocked: boolean }): void {
    if (event.blocked) {
      this.safetyService.blockUser(event.senderId).catch(console.error);
    } else {
      this.safetyService.unblockUser(event.senderId).catch(console.error);
    }
    this.isBlocked.set(event.blocked);
    if (event.blocked) {
      this.messageBlocked.emit(event.senderId);
    }
  }

  async onReport(event: { messageId: string; senderId: string }): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      this.i18n.translate('report.confirmMessage'),
    );
    if (!confirmed) return;
    this.safetyService
      .reportUser({
        reported_id: event.senderId,
        reason_category: 'other',
        description: 'Reported from message context menu',
        context_url: window.location.href,
      })
      .catch((err: unknown) => {
        console.error('Report failed', err);
      });
  }
}
