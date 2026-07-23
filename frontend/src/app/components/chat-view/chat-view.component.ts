import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [CommonModule, ChatMessageComponent],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <app-chat-message
          *ngFor="let msg of messages"
          [message]="msg"
          [currentUserId]="currentUserId"
        ></app-chat-message>
      </div>
      <div class="border-t p-4">
        <input
          type="text"
          [(ngModel)]="newMessageText"
          placeholder="Type a message..."
          class="w-full border rounded px-3 py-2"
          (keyup.enter)="sendTextMessage()"
        />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class ChatViewComponent implements OnInit {
  @Input({ required: true }) roomId!: string;
  @Input() currentUserId?: string;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  messages: ChatMessage[] = [];
  newMessageText = '';

  async ngOnInit(): Promise<void> {
    // If currentUserId not provided, fall back to auth service
    if (!this.currentUserId) {
      this.currentUserId = this.authService.currentUser()?.id;
    }
    await this.loadMessages();
  }

  private async loadMessages(): Promise<void> {
    try {
      this.messages = await this.chatService.getMessages(this.roomId);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }

  async sendTextMessage(): Promise<void> {
    const text = this.newMessageText?.trim();
    if (!text) return;

    try {
      const sent = await this.chatService.sendMessage({
        room_id: this.roomId,
        message_type: 'text',
        text_content: text,
      });
      this.messages.push(sent);
      this.newMessageText = '';
    } catch (err) {
      console.error('Failed to send message', err);
    }
  }
}
