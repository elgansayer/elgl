import { HlmInput } from '@spartan-ng/helm/input';
import { Component, input, OnInit, inject, signal, computed } from '@angular/core';

import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { SafetyService } from '../../services/safety.service';
import { DraftService } from '../../services/draft.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-view',
  imports: [HlmInput, FormsModule, ChatMessageComponent],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        @for (msg of filteredMessages(); track msg.id) {
          <app-chat-message
            [message]="msg"
            [currentUserId]="effectiveUserId()"
            (messageBlocked)="onMessageBlocked($event)"
          ></app-chat-message>
        }
      </div>
      <div class="border-t p-4">
        <input
          hlmInput
          type="text"
          [ngModel]="newMessageText"
          (ngModelChange)="onMessageTextChange($event)"
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
  roomId = input.required<string>();
  currentUserId = input<string>();

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private draftService = inject(DraftService);

  messages: ChatMessage[] = [];
  newMessageText = '';

  private blockedUserIds = signal<Set<string>>(new Set<string>());

  readonly effectiveUserId = computed(
    () => this.currentUserId() ?? this.authService.currentUser()?.id,
  );

  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    if (blocked.size === 0) return this.messages;
    return this.messages.filter((msg) => !blocked.has(msg.sender_id));
  });

  async ngOnInit(): Promise<void> {
    await this.loadMessages();
    await this.loadBlockedUsers();

    // Restore chat draft for this room
    const draft = this.draftService.loadChatDraft(this.roomId());
    if (draft) {
      this.newMessageText = draft;
    }
  }

  onMessageTextChange(value: string): void {
    this.newMessageText = value;
    this.draftService.saveChatDraft(this.roomId(), value);
  }

  private async loadMessages(): Promise<void> {
    try {
      this.messages = await this.chatService.getMessages(this.roomId());
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }

  private async loadBlockedUsers(): Promise<void> {
    const userId = this.effectiveUserId();
    if (!userId) return;
    try {
      const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);
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
        room_id: this.roomId(),
        message_type: 'text',
        text_content: text,
      });
      this.messages.push(sent);
      this.newMessageText = '';
      this.draftService.clearChatDraft(this.roomId());
    } catch (err) {
      console.error('Failed to send message', err);
    }
  }
}
