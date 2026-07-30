import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-page',
  imports: [FormsModule],
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

            <!-- Messages (inline rendering to support correction UI) -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4" #messagesContainer>
              @for (msg of messages(); track msg) {
                <div
                  class="group flex gap-2"
                  [class.flex-row-reverse]="msg.sender_id === currentUserId()"
                >
                  <!-- avatar -->
                  <img
                    [src]="msg.sender?.avatar_url ?? '/assets/default-avatar.svg'"
                    class="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
                    alt=""
                  />
                  <div
                    class="max-w-[75%] rounded-xl px-3 py-2 text-sm leading-relaxed "
                    [class.bg-blue-600/20]="msg.sender_id === currentUserId()"
                    [class.bg-surface-200/30]="msg.sender_id !== currentUserId()"
                  >
                    <!-- display name -->
                    @if (msg.sender && msg.sender.display_name) {
                      <p class="text-xs text-text-muted mb-1">{{ msg.sender.display_name }}</p>
                    }

                    <!-- Correction type message -->
                    @if (msg.message_type === 'correction' && msg.correction_payload) {
                      <div class="space-y-1">
                        <p class="text-xs line-through opacity-70">{{ msg.correction_payload.original }}</p>
                        <p class="text-green-400 font-medium">{{ msg.correction_payload.corrected }}</p>
                        @if (msg.correction_payload.explanation) {
                          <p class="text-xs text-text-muted mt-1 italic">{{ msg.correction_payload.explanation }}</p>
                        }
                      </div>
                    } @else if (msg.message_type === 'correction_request' && msg.correction_request_payload) {
                      <div>
                        <p class="text-sm">{{ msg.correction_request_payload.original_text }}</p>
                        <p class="text-xs text-yellow-400">✏️ Correction requested</p>
                      </div>
                    } @else {
                      <p>{{ msg.text_content }}</p>
                    }

                    <!-- media -->
                    @if (msg.media_url && !msg.is_view_once) {
                      <img [src]="msg.media_url" class="mt-1 rounded-lg max-h-60 object-contain" alt="" />
                    }
                    @if (msg.is_view_once && !msg.viewed_at) {
                      <button
                        (click)="viewMedia(msg)"
                        class="text-sm text-blue-400 underline mt-1"
                      >
                        Tap to view
                      </button>
                    }

                    <!-- action button: correct / fix / request correction -->
                    <div
                      class="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      @if (msg.sender_id !== currentUserId()) {
                        <button (click)="openCorrection(msg)" class="text-xs text-amber-400 hover:underline">
                          Correct
                        </button>
                        <button (click)="requestCorrection(msg)" class="text-xs text-blue-400 hover:underline">
                          Ask for correction
                        </button>
                      }
                      @if (msg.sender_id === currentUserId() && msg.message_type === 'text') {
                        <button (click)="openFix(msg)" class="text-xs text-sky-400 hover:underline">
                          Fix
                        </button>
                      }
                    </div>

                    <!-- timestamp -->
                    <p class="text-[10px] text-text-muted mt-1 text-end">
                      {{ msg.created_at | date:'shortTime' }}
                    </p>
                  </div>
                </div>
              }
            </div>

            <!-- Correction panel (when active) -->
            @if (correctionTargetMessage()) {
              <div class="p-4 border-t border-surface-100 bg-surface-200/50">
                <div class="space-y-2">
                  <p class="text-sm font-semibold">Correcting message from {{ correctionTargetMessage()?.sender?.display_name ?? 'User' }}</p>
                  <p class="text-xs text-text-muted line-through">{{ correctionTargetMessage()?.text_content }}</p>
                  <input
                    [ngModel]="correctionText()"
                    (ngModelChange)="correctionText.set($event)"
                    placeholder="Corrected text..."
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 "
                  />
                  <input
                    [ngModel]="correctionExplanation()"
                    (ngModelChange)="correctionExplanation.set($event)"
                    placeholder="Explanation (optional)"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 "
                  />
                  <div class="flex gap-2">
                    <button
                      (click)="submitCorrection()"
                      class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      Send Correction
                    </button>
                    <button
                      (click)="cancelCorrection()"
                      class="px-4 py-2 bg-surface-300 text-text-muted rounded-lg hover:bg-surface-400 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- Fix Message panel (when editing own message) -->
            @if (fixTargetMessage()) {
              <div class="p-4 border-t border-surface-100 bg-surface-200/50">
                <div class="space-y-2">
                  <p class="text-sm font-semibold">Fix your message</p>
                  <input
                    [ngModel]="fixText()"
                    (ngModelChange)="fixText.set($event)"
                    placeholder="Corrected text..."
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 "
                  />
                  <input
                    [ngModel]="fixExplanation()"
                    (ngModelChange)="fixExplanation.set($event)"
                    placeholder="Explanation (optional)"
                    class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 "
                  />
                  <div class="flex gap-2">
                    <button
                      (click)="submitFix()"
                      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Fix Message
                    </button>
                    <button
                      (click)="cancelFix()"
                      class="px-4 py-2 bg-surface-300 text-text-muted rounded-lg hover:bg-surface-400 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            }

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

  // correction state
  correctionTargetMessage = signal<ChatMessage | null>(null);
  correctionText = signal('');
  correctionExplanation = signal('');

  // fix message state (own messages)
  fixTargetMessage = signal<ChatMessage | null>(null);
  fixText = signal('');
  fixExplanation = signal('');

  currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

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
    this.correctionTargetMessage.set(null);
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

  // ---------- Correction actions ----------

  openCorrection(msg: ChatMessage): void {
    this.correctionTargetMessage.set(msg);
    this.correctionText.set(msg.text_content ?? '');
    this.correctionExplanation.set('');
  }

  cancelCorrection(): void {
    this.correctionTargetMessage.set(null);
    this.correctionText.set('');
    this.correctionExplanation.set('');
  }

  async openFix(msg: ChatMessage): void {
    this.fixTargetMessage.set(msg);
    this.fixText.set(msg.text_content ?? '');
    this.fixExplanation.set('');
  }

  cancelFix(): void {
    this.fixTargetMessage.set(null);
    this.fixText.set('');
    this.fixExplanation.set('');
  }

  async submitFix(): Promise<void> {
    const target = this.fixTargetMessage();
    if (!target) return;
    const corrected = this.fixText().trim();
    if (!corrected) return;

    try {
      const result = await this.chatService.fixMessage(
        target.id,
        corrected,
        this.fixExplanation().trim() || undefined,
      );
      // Update the message in the local list
      this.messages.update((msgs) =>
        msgs.map((m) => (m.id === result.id ? result : m)),
      );
      this.cancelFix();
    } catch (error) {
      console.error('Failed to fix message', error);
    }
  }

  async submitCorrection(): Promise<void> {
    const target = this.correctionTargetMessage();
    if (!target) return;
    const corrected = this.correctionText().trim();
    if (!corrected) return;

    try {
      const result = await this.chatService.sendMessage({
        room_id: target.room_id,
        message_type: 'correction',
        correction_payload: {
          original: target.text_content ?? '',
          corrected,
          explanation: this.correctionExplanation().trim() || undefined,
        },
        reply_to_id: target.id,
      });
      this.messages.update((msgs) => [...msgs, result]);
      this.cancelCorrection();
    } catch (error) {
      console.error('Failed to send correction', error);
      // fallback: show error in UI
    }
  }

  async requestCorrection(msg: ChatMessage): Promise<void> {
    try {
      const result = await this.chatService.sendMessage({
        room_id: msg.room_id,
        message_type: 'correction_request',
        correction_request_payload: {
          original_text: msg.text_content ?? '',
        },
        reply_to_id: msg.id,
      });
      this.messages.update((msgs) => [...msgs, result]);
    } catch (error) {
      console.error('Failed to request correction', error);
    }
  }

  async viewMedia(msg: ChatMessage): Promise<void> {
    // mark view-once media as viewed (future implementation)
    if (typeof window !== 'undefined') {
      alert('View-once media will be shown here for one time.');
    }
  }
}
