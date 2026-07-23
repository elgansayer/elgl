import { Component, input, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LongPressContextMenuComponent } from '../shared/long-press-context-menu/long-press-context-menu.component';
import { ChatMessage } from '../services/chat.service';
import { FavouriteService } from '../services/favourite.service';
import { SafetyService } from '../services/safety.service';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [LongPressContextMenuComponent, DatePipe],
  template: `
    <div class="flex flex-col" [class.items-end]="isOwnMessage()" [class.items-start]="!isOwnMessage()">
      <app-long-press-context-menu 
        [message]="message()" 
        [channelId]="channelId()"
        [showCopy]="true"
        [showFavourite]="true"
        [showReport]="!isOwnMessage()"
        (favouriteAdded)="onFavouriteAdded($event)"
        (reportSubmitted)="onReportSubmitted($event)"
      >
        <div 
          class="message-bubble p-3 rounded-lg cursor-pointer select-none"
          [class.bg-blue-600]="isOwnMessage()"
          [class.bg-gray-700]="!isOwnMessage()"
        >
          <p class="text-white text-sm">{{ message().text_content }}</p>
          @if (message().media_url) {
            <img [src]="message().media_url" class="mt-2 rounded max-w-full max-h-64 object-cover" />
          }
          <span class="text-xs text-gray-400 mt-1 block">
            {{ message().created_at | date:'short' }}
          </span>
        </div>
      </app-long-press-context-menu>
    </div>
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

  onReportSubmitted(messageId: string): void {
    const msg = this.message();
    this.safetyService.reportUser({
      reported_id: msg.sender_id,
      reason: 'Inappropriate message content',
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
