import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatMessageComponent } from '../../components/chat-message/chat-message.component';

@Component({
  selector: 'app-chat-page',
  imports: [FormsModule, ChatMessageComponent],
  template: `
    <div class="flex h-full">
      <!-- Room List -->
      <aside class="w-80 border-e border-surface-100  overflow-y-auto">
        <div class="p-4">
          <h2 class="text-lg font-semibold mb-4">Chats</h2>
          @for (room of rooms(); track room) {
            <div
              (click)="selectRoom(room)"
              (keydown.enter)="selectRoom(room)"
              tabindex="0"
              role="button"
              class="cursor-pointer p-3 rounded-lg hover:bg-surface-300 :bg-surface-200 transition-colors"
              [class.bg-blue-500/10]="selectedRoom()?.id === room.id"
            >
              <div class="flex items-center gap-3">
                <img [src]="room.avatar" class="w-10 h-10 rounded-full object-cover" alt="" />
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{{ room.title }}</p>
                  <p class="text-sm text-text-muted truncate">{{ room.subtitle }}</p>
                </div>
                @if (room.is_online) {
                  <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                }
              </div>
            </div>
          }
        </div>
      </aside>

      <!-- Chat Area -->
      <main class="flex-1 flex flex-col">
        @if (selectedRoom(); as room) {
          <div class="flex-1 flex flex-col">
            <!-- Header -->
            <div class="p-4 border-b border-surface-100 ">
              <div class="flex items-center gap-3">
                <img [src]="room.avatar" class="w-10 h-10 rounded-full object-cover" alt="" />
                <div>
                  <h3 class="font-semibold">{{ room.title }}</h3>
                  <p class="text-sm text-text-muted">{{ room.subtitle }}</p>
                </div>
              </div>
            </div>
            <!-- Messages -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4" #messagesContainer>
              @for (msg of messages(); track msg) {
                <app-chat-message [message]="msg"></app-chat-message>
              }
            </div>
            <!-- Input -->
            <div class="p-4 border-t border-surface-100 ">
              <div class="flex gap-2">
                <input
                  [ngModel]="newMessageText()"
                  (ngModelChange)="newMessageText.set($event)"
                  (keyup.enter)="sendMessage()"
                  placeholder="Type a message..."
                  class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500  "
                />
                <button
                  (click)="sendMessage()"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        }

        <!-- No room selected -->
        @if (!selectedRoom()) {
          <div class="flex-1 flex items-center justify-center text-text-muted">
            Select a chat to start messaging
          </div>
        }
      </main>
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
export class ChatPageComponent implements OnInit {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  rooms = signal<ChatRoom[]>([]);
  selectedRoom = signal<ChatRoom | null>(null);
  messages = signal<ChatMessage[]>([]);
  newMessageText = signal('');

  async ngOnInit() {
    try {
      const rooms = await this.chatService.getRooms();
      this.rooms.set(rooms);
    } catch (error) {
      console.error('Failed to load rooms', error);
    }
  }

  async selectRoom(room: ChatRoom) {
    this.selectedRoom.set(room);
    try {
      const messages = await this.chatService.getMessages(room.id);
      this.messages.set(messages);
    } catch (error) {
      console.error('Failed to load messages', error);
    }
  }

  async sendMessage() {
    const room = this.selectedRoom();
    const text = this.newMessageText();
    if (!room || !text.trim()) return;

    try {
      const message = await this.chatService.sendMessage({
        room_id: room.id,
        message_type: 'text',
        text_content: text.trim(),
      });
      this.messages.update((msgs) => [...msgs, message]);
      this.newMessageText.set('');
    } catch (error) {
      console.error('Failed to send message', error);
    }
  }
}
