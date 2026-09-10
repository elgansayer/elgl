import { HlmButton } from '@spartan-ng/helm/button';
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
import { environment } from '../../../environments/environment';
import { VisualDiffComponent } from '../visual-diff/visual-diff.component';

type VoicePlaybackSpeed = 1 | 1.5 | 2;

@Component({
  selector: 'app-chat-message',
  imports: [
    HlmButton,
    CommonModule,
    LongPressContextMenuComponent,
    TranslatePipe,
    CulturalTipComponent,
    LinkPreviewCardComponent,
    VisualDiffComponent,
  ],
  template: `
    @if (!isBlocked()) {
      @if (isFirstMessage() && partnerLanguage(); as lang) {
        <app-cultural-tip [language]="lang" />
      }
      <app-long-press-context-menu
        [messageId]="message().id"
        [messageContent]="message().text_content ?? ''"
        [messageType]="message().message_type"
        [correctionOriginal]="message().correction_payload?.original ?? null"
        [correctionCorrected]="message().correction_payload?.corrected ?? null"
        [senderId]="message().sender_id"
        [roomId]="message().room_id"
        [isBlocked]="isBlocked()"
        (copyMessage)="onCopy($event)"
        (favourite)="onFavourite($event)"
        (report)="onReport($event)"
        (block)="onBlockToggle($event)"
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
            [class.bg-primary]="isOwnMessage()"
            [class.text-on-fill]="isOwnMessage()"
            [class.bg-surface-300]="!isOwnMessage()"
          >
            <span
              class="chat-bubble-tail"
              [class.chat-bubble-tail--sent]="isOwnMessage()"
              [class.chat-bubble-tail--received]="!isOwnMessage()"
              aria-hidden="true"
            ></span>
            @if (message().is_forwarded) {
              <p class="text-xs mb-1 text-text-muted italic font-medium">
                {{ 'chatRoom.forwarded' | t }}
              </p>
            }
            @if (message().message_type === 'text') {
              <p class="text-sm">
                @for (segment of textSegments(); track $index) {
                  @if (segment.isMention) {
                    <span class="font-bold text-secondary cursor-pointer">{{ segment.value }}</span>
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
            }

            @if (message().message_type === 'voice') {
              <div class="flex flex-wrap items-center gap-2">
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  variant="ghost"
                  [attr.aria-label]="'chatRoom.playVoiceMessage' | t"
                  (click)="playVoice()"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                    />
                  </svg>
                </button>
                <span class="text-sm">{{ 'chatRoom.voiceMessage' | t }}</span>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  variant="ghost"
                  class="min-w-11 px-2 tabular-nums"
                  [attr.aria-label]="('chatRoom.voiceMessage' | t) + ' ' + playbackSpeed() + '×'"
                  (click)="cycleVoicePlaybackSpeed()"
                >
                  {{ playbackSpeed() }}×
                </button>
              </div>
              @if (message().media_url) {
                <div class="mt-2 text-xs opacity-80 italic border-s-2 border-secondary ps-2">
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
                <app-visual-diff
                  [original]="message().correction_payload!.original"
                  [corrected]="message().correction_payload!.corrected"
                  [explanation]="message().correction_payload!.explanation"
                  [showActions]="true"
                ></app-visual-diff>
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
                  @if (
                    message().delivery_status === 'sent' ||
                    (!message().delivery_status && message().is_read)
                  ) {
                    <!-- Single check: sent -->
                    <svg
                      class="w-3.5 h-3.5 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  }
                  @if (message().delivery_status === 'delivered') {
                    <!-- Double check: delivered (gray) -->
                    <svg
                      class="w-3.5 h-3.5 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <svg
                      class="w-3.5 h-3.5 -ms-2 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  }
                  @if (message().delivery_status === 'read') {
                    <!-- Double check: read (blue) -->
                    <svg
                      class="w-3.5 h-3.5 text-secondary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <svg
                      class="w-3.5 h-3.5 -ms-2 text-secondary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M5 13l4 4L19 7"
                      />
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
  private activeVoiceAudio: HTMLAudioElement | null = null;

  isBlocked = signal(false);
  voiceTranscription = signal<string | null>(null);
  voiceTranscribing = signal(false);
  playbackSpeed = signal<VoicePlaybackSpeed>(1);

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
      if (
        msg.message_type === 'voice' &&
        msg.media_url &&
        !this.voiceTranscribing() &&
        !this.voiceTranscription()
      ) {
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

  cycleVoicePlaybackSpeed(): void {
    const current = this.playbackSpeed();
    const next: VoicePlaybackSpeed = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
    this.playbackSpeed.set(next);
    if (this.activeVoiceAudio) {
      this.activeVoiceAudio.playbackRate = next;
    }
  }

  playVoice(): void {
    const mediaUrl = this.message().media_url;
    if (!mediaUrl) return;

    const audio = new Audio(mediaUrl);
    audio.playbackRate = this.playbackSpeed();
    this.activeVoiceAudio = audio;
    audio.addEventListener(
      'ended',
      () => {
        if (this.activeVoiceAudio === audio) {
          this.activeVoiceAudio = null;
        }
      },
      { once: true },
    );
    audio.play().catch((error: unknown) => {
      if (this.activeVoiceAudio === audio) {
        this.activeVoiceAudio = null;
      }
      console.error(error);
    });
  }

  async fetchTranscription(audioUrl: string): Promise<void> {
    this.voiceTranscribing.set(true);
    try {
      const res = await fetch(`${environment.apiUrl}/nlp/transcribe-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: audioUrl }),
      });
      if (!res.ok) {
        throw new Error('Transcription request failed');
      }
      const data = await res.json();
      this.voiceTranscription.set(data.original_text || null);
    } catch (err) {
      console.error('Transcription error:', err);
      this.voiceTranscription.set(null);
    } finally {
      this.voiceTranscribing.set(false);
    }
  }

  onCopy(event: { messageId: string; content: string }): void {
    navigator.clipboard.writeText(event.content).catch(console.error);
  }

  onFavourite(event: { messageId: string; content: string; messageType: string }): void {
    this.favouriteService.addFavourite({ message_id: event.messageId }).catch(() => {});
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
