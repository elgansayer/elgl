import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';

import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { SafetyService } from '../../services/safety.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [FormsModule, ChatMessageComponent],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        @for (msg of filteredMessages(); track msg) {
          <app-chat-message
            [message]="msg"
            [currentUserId]="currentUserId"
            (messageBlocked)="onMessageBlocked($event)"
          ></app-chat-message>
        }
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
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class ChatViewComponent implements OnInit {
  @Input({ required: true }) roomId!: string;
  @Input() currentUserId?: string;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);

  messages: ChatMessage[] = [];
  newMessageText = '';

  private blockedUserIds = signal<Set<string>>(new Set());

  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    if (blocked.size === 0) return this.messages;
    return this.messages.filter((msg) => !blocked.has(msg.sender_id));
  });

  async ngOnInit(): Promise<void> {
    // If currentUserId not provided, fall back to auth service
    if (!this.currentUserId) {
      this.currentUserId = this.authService.currentUser()?.id;
    }
    await this.loadMessages();
    await this.loadBlockedUsers();
  }

  private async loadMessages(): Promise<void> {
    try {
      this.messages = await this.chatService.getMessages(this.roomId);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }

  private async loadBlockedUsers(): Promise<void> {
    try {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(this.currentUserId!);
      this.blockedUserIds.set(new Set(blockedIds));
    } catch (err) {
      console.error('Failed to load blocked users', err);
    }
  }

  onMessageBlocked(userId: string): void {
    this.blockedUserIds.update((ids) => {
      const newSet = new Set(ids);
      if (newSet.has(userId)) {
        newSet.delete(userId); // Unblock
      } else {
        newSet.add(userId); // Block
      }
      return newSet;
    });
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
