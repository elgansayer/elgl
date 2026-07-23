import { Component, input } from '@angular/core';
import { LongPressContextMenuComponent } from '../shared/long-press-context-menu/long-press-context-menu.component';
import { ChatMessage } from '../services/chat.service';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [LongPressContextMenuComponent],
  template: `
    <app-long-press-context-menu 
      [message]="message()" 
      [channelId]="channelId()"
      (favouriteAdded)="onFavouriteAdded($event)"
      (reportSubmitted)="onReportSubmitted($event)"
    >
      <div class="message-bubble p-3 rounded-lg bg-gray-700">
        <p class="text-white">{{ message().text_content }}</p>
        @if (message().media_url) {
          <img [src]="message().media_url" class="mt-2 rounded max-w-full" />
        }
      </div>
    </app-long-press-context-menu>
  `
})
export class ChatMessageComponent {
  message = input.required<ChatMessage>();
  channelId = input<string>('');

  onFavouriteAdded(messageId: string): void {
    console.log('Message added to favourites:', messageId);
  }

  onReportSubmitted(messageId: string): void {
    console.log('Message reported:', messageId);
  }
}
