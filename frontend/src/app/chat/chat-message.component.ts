import { Component, input, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LongPressContextMenuComponent } from '../components/long-press-context-menu/long-press-context-menu.component';
import { ChatMessage } from '../services/chat.service';
import { FavouriteService } from '../services/favourite.service';
import { SafetyService } from '../services/safety.service';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-chat-message-alt',
  standalone: true,
  imports: [LongPressContextMenuComponent, DatePipe, TranslatePipe],
  template: `
    @if (message().message_type === 'system' && message().system_event) {
      <div class="flex justify-center w-full my-2">
        <span class="rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs px-4 py-1">
          {{ message().system_event?.message }}
        </span>
      </div>
    } @else {
      <div class="flex flex-col" [class.items-end]="isOwnMessage()" [class.items-start]="!isOwnMessage()">
        <app-long-press-context-menu 
          [messageId]="message().id"
          [messageContent]="message().text_content ?? ''"
          [messageType]="message().message_type"
          [senderId]="message().sender_id"
          [roomId]="channelId()"
          (favourite)="onFavouriteAdded($event.messageId)"
          (report)="onReportSubmitted()"
        >
          <div 
            class="message-bubble p-3 rounded-lg cursor-pointer select-none"
            [class.bg-blue-600]="isOwnMessage()"
            [class.bg-surface-100]="!isOwnMessage()"
          >
            <p class="text-white text-sm">{{ message().text_content }}</p>
            @if (message().media_url) {
              <img [src]="message().media_url" [alt]="'chat.attachedImageAlt' | t" class="mt-2 rounded max-w-full max-h-64 object-cover" />
            }
            <span class="text-xs text-text-muted mt-1 block">
              {{ message().created_at | date:'short' }}
            </span>
          </div>
        </app-long-press-context-menu>
      </div>
    }
  `,
  styles: [`
    .message-bubble {
      max-width: 75%;
      word-wrap: break-word;
    }
  `]
})
export class ChatMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly channelId = input<string>('');
  readonly isOwnMessage = input<boolean>(false);
  private favouriteService = inject(FavouriteService);
  private safetyService = inject(SafetyService);

  onFavouriteAdded(messageId: string): void {
    this.favouriteService.addFavourite({ message_id: messageId }).subscribe({
      next: () => {
        // Optionally show a toast or update UI
      },
      error: (err) => {
        console.error('Failed to add favourite', err);
      },
    });
  }

  onReportSubmitted(): void {
    const msg = this.message();
    this.safetyService.reportUser({
      reported_id: msg.sender_id,
      reason_category: 'inappropriate_content',
      description: 'Inappropriate message content',
      context_url: `${window.location.origin}/chat/${this.channelId()}`,
    }).subscribe({
      next: () => {
        // Optionally show a toast
      },
      error: (err) => {
        console.error('Failed to report message', err);
      },
    });
  }
}
