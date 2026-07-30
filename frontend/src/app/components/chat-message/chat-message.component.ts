import { Component, input, output, inject, signal, effect } from '@angular/core';
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

@Component({
  selector: 'app-chat-message',
  imports: [CommonModule, LongPressContextMenuComponent, TranslatePipe, CulturalTipComponent],
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
        (copyMessage)="onCopy($event)"
        (favourite)="onFavourite($event)"
        (report)="onReport($event)"
      >
        <div
          class="flex"
          [class.justify-end]="isOwnMessage()"
          [class.justify-start]="!isOwnMessage()"
        >
          <div
            class="max-w-[70%] rounded-lg p-3"
            [class.bg-blue-600]="isOwnMessage()"
            [class.text-white]="isOwnMessage()"
            [class.bg-surface-300]="!isOwnMessage()"
          >
            @if (message().message_type === 'text') {
              <p class="text-sm">{{ message().text_content }}</p>
            }

            @if (message().message_type === 'voice') {
              <div class="flex items-center gap-2">
                <button (click)="playVoice()" class="p-2 rounded-full hover:bg-black/10">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"
                    />
                  </svg>
                </button>
                <span class="text-sm">{{ 'chatRoom.voiceMessage' | t }}</span>
              </div>
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

            <p class="text-xs mt-1 opacity-60 text-end">
              {{ message().created_at | date: 'shortTime' }}
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

  isBlocked = signal(false);

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

  onCopy(event: { messageId: string; content: string }): void {
    navigator.clipboard.writeText(event.content).catch(console.error);
  }

  onFavourite(event: { messageId: string; content: string; messageType: string }): void {
    this.favouriteService.addFavourite({ message_id: event.messageId }).catch(() => {});
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
