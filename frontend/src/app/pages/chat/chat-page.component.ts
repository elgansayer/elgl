import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AiConversationService, Scenario } from '../../services/ai-conversation.service';
import { A11yClickableDirective } from '../../components/primitives/a11y-clickable';
import { VisualDiffComponent } from '../../components/visual-diff/visual-diff.component';

interface AiChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  created_at: Date;
}

@Component({
  selector: 'app-chat-page',
  imports: [HlmInput, HlmButton, FormsModule, DatePipe, TranslatePipe, A11yClickableDirective, VisualDiffComponent],
  template: `
    <div class="flex h-full">
      <!-- Room List -->
      <aside class="w-80 border-e border-surface-100  overflow-y-auto">
        <div class="p-4">
          <h2 class="text-lg font-semibold mb-4">{{ 'chat.rooms' | t }}</h2>
          <button
            hlmBtn
            (click)="startAiPartner()"
            class="mb-4 w-full ps-3 pe-3 py-2 bg-primary text-on-fill rounded-lg hover:bg-primary/80 transition-colors"
          >
            {{ 'aiPartner.start' | t }}
          </button>
          @for (room of rooms(); track room) {
            <div
              (click)="selectRoom(room)"
              appA11yClickable
              tabindex="0"
              class="cursor-pointer p-3 rounded-lg hover:bg-surface-300 :bg-surface-200 transition-colors"
              [class.bg-primary/10]="selectedRoom()?.id === room.id"
            >
              <div class="flex items-center gap-3">
                <img
                  [src]="room.avatar"
                  class="w-10 h-10 rounded-full object-cover"
                  alt=""
                  loading="lazy"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{{ room.title }}</p>
                  <p class="text-sm text-text-muted truncate">{{ room.subtitle }}</p>
                </div>
                @if (room.is_online) {
                  <span class="w-2 h-2 bg-success rounded-full"></span>
                }
              </div>
            </div>
          }
        </div>
      </aside>

      <!-- Chat Area -->
      <main class="flex-1 flex flex-col">
        @if (aiMode()) {
          <!-- AI Conversation Partner -->
          <div class="flex-1 flex flex-col">
            <!-- AI header -->
            <div class="p-4 border-b border-surface-100">
              <div class="flex items-center gap-3">
                @if (aiSelectedScenario(); as sc) {
                  <span class="text-xl" aria-hidden="true">{{ sc.icon }}</span>
                  <h3 class="font-semibold">{{ sc.name }}</h3>
                } @else {
                  <span class="text-xl" aria-hidden="true">🤖</span>
                  <h3 class="font-semibold">{{ 'aiPartner.title' | t }}</h3>
                }
                <button
                  hlmBtn
                  (click)="closeAiPartner()"
                  class="ms-auto text-sm text-text-muted hover:underline"
                >
                  {{ 'aiPartner.exit' | t }}
                </button>
              </div>
            </div>

            @if (!aiSelectedScenario()) {
              <!-- Scenario Selection -->
              <div class="flex-1 overflow-y-auto p-4 space-y-3">
                <h4 class="text-sm font-medium text-text-muted mb-2">
                  {{ 'aiConversation.chooseScenario' | t }}
                </h4>
                <p class="text-xs text-text-muted mb-4">
                  {{ 'aiConversation.chooseScenarioDesc' | t }}
                </p>
                @if (aiScenariosLoading()) {
                  <p class="text-sm text-text-muted animate-pulse">{{ 'common.loading' | t }}</p>
                } @else {
                  @for (scenario of aiScenarios(); track scenario.id) {
                    <button
                      hlmBtn
                      type="button"
                      (click)="selectAiScenario(scenario)"
                      class="flex items-center gap-3 w-full text-start bg-surface-200/30 hover:bg-surface-300/50 active:bg-surface-400/50 text-text-primary px-4 py-3 rounded-xl transition-colors"
                    >
                      <span class="text-xl" aria-hidden="true">{{ scenario.icon }}</span>
                      <span class="text-sm">{{ scenario.name }}</span>
                    </button>
                  }
                  <button
                    hlmBtn
                    type="button"
                    (click)="selectAiScenario(null)"
                    class="flex items-center gap-3 w-full text-start bg-surface-200/30 hover:bg-surface-300/50 active:bg-surface-400/50 text-text-primary px-4 py-3 rounded-xl transition-colors"
                  >
                    <span class="text-xl" aria-hidden="true">💬</span>
                    <span class="text-sm">{{ 'aiPartner.freeConversation' | t }}</span>
                  </button>
                }
              </div>
            } @else {
              <!-- AI messages -->
              <div class="flex-1 overflow-y-auto p-4 space-y-4">
                @for (msg of aiMessages(); track msg.id) {
                  <div class="flex gap-2" [class.flex-row-reverse]="msg.role === 'user'">
                    <img
                      [src]="
                        msg.role === 'ai' ? '/assets/ai-partner.svg' : '/assets/default-avatar.svg'
                      "
                      class="w-8 h-8 rounded-full object-cover shrink-0 mt-1"
                      alt=""
                      loading="lazy"
                    />
                    <div
                      class="max-w-[75%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                      [class.bg-primary/20]="msg.role === 'user'"
                      [class.bg-surface-200/30]="msg.role !== 'user'"
                    >
                      <p>{{ msg.text }}</p>
                      <p class="text-[10px] text-text-muted mt-1 text-end">
                        {{ msg.created_at | date: 'shortTime' }}
                      </p>
                    </div>
                  </div>
                }
                @if (aiLoading()) {
                  <div class="flex items-center gap-2 text-sm text-text-muted">
                    <span class="animate-pulse">{{ 'aiPartner.typing' | t }}</span>
                  </div>
                }
                @if (aiError()) {
                  <p class="text-sm text-danger">{{ aiError() | t }}</p>
                }
              </div>

              <!-- AI input -->
              <div class="p-4 border-t border-surface-100">
                <div class="flex gap-2">
                  <input
                    hlmInput
                    [ngModel]="aiInput()"
                    (ngModelChange)="aiInput.set($event)"
                    (keyup.enter)="sendAiMessage()"
                    [placeholder]="'aiPartner.inputPlaceholder' | t"
                    class="flex-1 ps-3 pe-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    hlmBtn
                    (click)="sendAiMessage()"
                    [disabled]="aiLoading() || !aiInput().trim()"
                    class="ps-3 pe-3 py-2 bg-primary text-on-fill rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
                  >
                    {{ 'aiPartner.send' | t }}
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          @if (selectedRoom(); as room) {
            <div class="flex-1 flex flex-col">
              <!-- Header -->
              <div class="p-4 border-b border-surface-100 ">
                <div class="flex items-center gap-3">
                  <img
                    [src]="room.avatar"
                    class="w-10 h-10 rounded-full object-cover"
                    alt=""
                    loading="lazy"
                  />
                  <div>
                    <h3 class="font-semibold">{{ room.title }}</h3>
                    <p class="text-sm text-text-muted">{{ room.subtitle }}</p>
                  </div>
                  <button
                    hlmBtn
                    (click)="exportChat()"
                    class="ms-auto p-2 text-sm text-text-muted hover:text-text transition-colors"
                  >
                    {{ 'chat.exportHistory' | t }}
                  </button>
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
                      loading="lazy"
                    />
                    <div
                      class="max-w-[75%] rounded-xl px-3 py-2 text-sm leading-relaxed "
                      [class.bg-primary/20]="msg.sender_id === currentUserId()"
                      [class.bg-surface-200/30]="msg.sender_id !== currentUserId()"
                    >
                      <!-- display name -->
                      @if (msg.sender && msg.sender.display_name) {
                        <p class="text-xs text-text-muted mb-1">{{ msg.sender.display_name }}</p>
                      }

                      <!-- Correction type message -->
                      @if (msg.message_type === 'status_reply' && msg.status_reply_payload) {
                        <div class="space-y-1">
                          <p class="text-xs text-text-muted">{{ 'chat.statusReply' | t }}</p>
                          <p class="text-sm">{{ msg.status_reply_payload.status_text }}</p>
                          <button
                            hlmBtn
                            (click)="replyToStatus(msg)"
                            class="text-xs text-primary hover:underline"
                          >
                            {{ 'chat.replyToStatus' | t }}
                          </button>
                        </div>
                      } @else if (msg.message_type === 'correction' && msg.correction_payload) {
                        <app-visual-diff
                          [original]="msg.correction_payload.original"
                          [corrected]="msg.correction_payload.corrected"
                          [explanation]="msg.correction_payload.explanation"
                          [showActions]="true"
                        ></app-visual-diff>
                      } @else if (
                        msg.message_type === 'correction_request' && msg.correction_request_payload
                      ) {
                        <div>
                          <p class="text-sm">{{ msg.correction_request_payload.original_text }}</p>
                          <p class="text-xs text-warning">✏️ {{ 'chatRoom.correctionRequested' | t }}</p>
                        </div>
                      } @else {
                        <p>{{ msg.text_content }}</p>
                      }

                      <!-- media -->
                      @if (msg.media_url && !msg.is_view_once) {
                        <img
                          [src]="msg.media_url"
                          class="mt-1 rounded-lg max-h-60 object-contain"
                          alt=""
                          loading="lazy"
                        />
                      }
                      @if (msg.is_view_once && !msg.viewed_at) {
                        <button
                          hlmBtn
                          (click)="viewMedia(msg)"
                          class="text-sm text-primary underline mt-1"
                        >
                          Tap to view
                        </button>
                      }

                      <!-- action button: correct / fix / request correction -->
                      <div
                        class="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        @if (msg.sender_id !== currentUserId()) {
                          <button
                            hlmBtn
                            (click)="openCorrection(msg)"
                            class="text-xs text-warning hover:underline"
                          >
                            Correct
                          </button>
                          <button
                            hlmBtn
                            (click)="requestCorrection(msg)"
                            class="text-xs text-primary hover:underline"
                          >
                            Ask for correction
                          </button>
                        }
                        @if (msg.sender_id === currentUserId() && msg.message_type === 'text') {
                          <button
                            hlmBtn
                            (click)="openFix(msg)"
                            class="text-xs text-secondary hover:underline"
                          >
                            Fix
                          </button>
                        }
                      </div>

                      <!-- timestamp + read receipts -->
                      <p
                        class="text-[10px] text-text-muted mt-1 text-end flex items-center justify-end gap-0.5"
                      >
                        {{ msg.created_at | date: 'shortTime' }}
                        @if (msg.sender_id === currentUserId()) {
                          <span class="inline-flex items-center">
                            @if (msg.delivery_status === 'read') {
                              <svg
                                class="w-3 h-3 text-primary"
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
                                class="w-3 h-3 -ms-2 text-primary"
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
                            } @else if (msg.delivery_status === 'delivered') {
                              <svg
                                class="w-3 h-3 text-text-muted"
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
                                class="w-3 h-3 -ms-2 text-text-muted"
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
                            } @else if (msg.delivery_status === 'sent') {
                              <svg
                                class="w-3 h-3 text-text-secondary"
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
                }
              </div>

              <!-- Correction panel (when active) -->
              @if (correctionTargetMessage()) {
                <div class="p-4 border-t border-surface-100 bg-surface-200/50">
                  <div class="space-y-2">
                    <p class="text-sm font-semibold">
                      Correcting message from
                      {{ correctionTargetMessage()?.sender?.display_name ?? 'User' }}
                    </p>
                    <p class="text-xs text-text-muted line-through">
                      {{ correctionTargetMessage()?.text_content }}
                    </p>
                    <input
                      hlmInput
                      [ngModel]="correctionText()"
                      (ngModelChange)="correctionText.set($event)"
                      placeholder="Corrected text..."
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success "
                    />
                    <input
                      hlmInput
                      [ngModel]="correctionExplanation()"
                      (ngModelChange)="correctionExplanation.set($event)"
                      placeholder="Explanation (optional)"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success "
                    />
                    <div class="flex gap-2">
                      <button
                        hlmBtn
                        (click)="submitCorrection()"
                        class="px-4 py-2 bg-success text-on-fill rounded-lg hover:bg-success/80 transition-colors text-sm"
                      >
                        Send Correction
                      </button>
                      <button
                        hlmBtn
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
                      hlmInput
                      [ngModel]="fixText()"
                      (ngModelChange)="fixText.set($event)"
                      placeholder="Corrected text..."
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success "
                    />
                    <input
                      hlmInput
                      [ngModel]="fixExplanation()"
                      (ngModelChange)="fixExplanation.set($event)"
                      placeholder="Explanation (optional)"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success "
                    />
                    <div class="flex gap-2">
                      <button
                        hlmBtn
                        (click)="submitFix()"
                        class="px-4 py-2 bg-primary text-on-fill rounded-lg hover:bg-primary/80 transition-colors text-sm"
                      >
                        Fix Message
                      </button>
                      <button
                        hlmBtn
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
                    hlmInput
                    [ngModel]="newMessageText()"
                    (ngModelChange)="newMessageText.set($event)"
                    (keyup.enter)="sendMessage()"
                    placeholder="Type a message..."
                    class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary  "
                  />
                  <button
                    hlmBtn
                    (click)="sendMessage()"
                    class="px-4 py-2 bg-primary text-on-fill rounded-lg hover:bg-primary/80 transition-colors"
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
              {{ 'chat.emptyState' | t }}
            </div>
          }
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
  private aiConversationService = inject(AiConversationService);
  private centrifugoService = inject(CentrifugoService);
  private i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  rooms = signal<ChatRoom[]>([]);
  selectedRoom = signal<ChatRoom | null>(null);
  messages = signal<ChatMessage[]>([]);
  newMessageText = signal('');
  private subscribedRoomId: string | null = null;

  // correction state
  correctionTargetMessage = signal<ChatMessage | null>(null);
  correctionText = signal('');
  correctionExplanation = signal('');

  // fix message state (own messages)
  fixTargetMessage = signal<ChatMessage | null>(null);
  fixText = signal('');
  fixExplanation = signal('');

  // AI conversation partner state
  aiMode = signal(false);
  aiScenarios = signal<Scenario[]>([]);
  aiScenariosLoading = signal(false);
  aiSelectedScenario = signal<Scenario | null>(null);
  aiMessages = signal<AiChatMessage[]>([]);
  aiInput = signal('');
  aiLoading = signal(false);
  aiError = signal('');

  currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

  async ngOnInit() {
    try {
      const rooms = await this.chatService.getRooms();
      this.rooms.set(rooms);
    } catch (error) {
      console.error('Failed to load rooms', error);
    }

    this.destroyRef.onDestroy(() => {
      if (this.subscribedRoomId) {
        this.centrifugoService.unsubscribe(`chat:${this.subscribedRoomId}`);
      }
    });
  }

  async selectRoom(room: ChatRoom) {
    // Unsubscribe previous room
    if (this.subscribedRoomId && this.subscribedRoomId !== room.id) {
      this.centrifugoService.unsubscribe(`chat:${this.subscribedRoomId}`);
      this.subscribedRoomId = null;
    }

    this.selectedRoom.set(room);
    this.correctionTargetMessage.set(null);
    try {
      const messages = await this.chatService.getMessages(room.id);
      this.messages.set(messages);

      // Subscribe to real-time updates for this room (status updates, new messages, deletions)
      if (this.subscribedRoomId !== room.id) {
        this.subscribedRoomId = room.id;
        this.centrifugoService.subscribe(`chat:${room.id}`, (data: unknown) => {
          this.handleCentrifugoEvent(data as Record<string, unknown>);
        });
      }

      // Auto-mark messages from others as delivered and then read
      const currentUserId = this.authService.currentUser()?.id;
      if (currentUserId) {
        const messagesFromOthers = messages.filter(
          (m) =>
            m.sender_id !== currentUserId &&
            m.delivery_status !== 'delivered' &&
            m.delivery_status !== 'read',
        );
        for (const msg of messagesFromOthers) {
          void this.chatService.markMessageStatus(msg.id, 'delivered');
          void this.chatService.markMessageStatus(msg.id, 'read');
        }
      }
    } catch (error) {
      console.error('Failed to load messages', error);
    }
  }

  private handleCentrifugoEvent(data: Record<string, unknown>): void {
    // Handle status update events
    if (data['status_update']) {
      const update = data['status_update'] as Record<string, unknown>;
      const messageId = update['message_id'] as string;
      const deliveryStatus = update['delivery_status'] as string;
      if (messageId && deliveryStatus) {
        this.messages.update((msgs) =>
          msgs.map((m) =>
            m.id === messageId
              ? { ...m, delivery_status: deliveryStatus as ChatMessage['delivery_status'] }
              : m,
          ),
        );
      }
      return;
    }

    // Handle incoming new messages
    if (data['message']) {
      const msg = data['message'] as ChatMessage;
      if (msg && msg.id && msg.room_id) {
        this.messages.update((msgs) => {
          // Avoid duplicates
          if (msgs.some((m) => m.id === msg.id)) return msgs;
          return [...msgs, msg];
        });
      }
      return;
    }

    // Handle message deletion events
    if (data['type'] === 'message_deleted') {
      const deletedId = data['message_id'] as string;
      const deletedFor = data['deleted_for'] as string;
      if (deletedId) {
        this.messages.update((msgs) => {
          if (deletedFor === 'everyone') {
            return msgs.filter((m) => m.id !== deletedId);
          }
          return msgs.filter((m) => m.id !== deletedId);
        });
      }
    }
  }

  async exportChat(): Promise<void> {
    const room = this.selectedRoom();
    if (!room) return;
    try {
      await this.chatService.downloadChatHistory(room.id);
    } catch (error) {
      console.error('Failed to export chat history', error);
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

  async openFix(msg: ChatMessage): Promise<void> {
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
      this.messages.update((msgs) => msgs.map((m) => (m.id === result.id ? result : m)));
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

  async viewMedia(_msg: ChatMessage): Promise<void> {
    // mark view-once media as viewed (future implementation)
    if (typeof window !== 'undefined') {
      alert('View-once media will be shown here for one time.');
    }
  }

  async replyToStatus(msg: ChatMessage): Promise<void> {
    if (!msg.status_reply_payload) return;
    const targetUserId = msg.sender_id ?? '';
    if (!targetUserId) return;
    try {
      const result = await this.chatService.replyToStatusUpdate({
        target_user_id: targetUserId,
        status_update_id: msg.status_reply_payload.status_update_id,
        status_text: msg.status_reply_payload.status_text,
      });
      this.messages.update((msgs) => [...msgs, result]);
    } catch (error) {
      console.error('Failed to reply to status update', error);
    }
  }

  // ---------- AI Conversation Partner ----------

  startAiPartner(): void {
    this.aiMode.set(true);
    this.selectedRoom.set(null);
    this.aiError.set('');
    this.aiSelectedScenario.set(null);
    if (this.aiScenarios().length === 0 && !this.aiScenariosLoading()) {
      this.loadAiScenarios();
    }
  }

  closeAiPartner(): void {
    this.aiMode.set(false);
    this.aiSelectedScenario.set(null);
    this.aiMessages.set([]);
  }

  private async loadAiScenarios(): Promise<void> {
    this.aiScenariosLoading.set(true);
    try {
      const scenarios = await this.aiConversationService.getScenarios();
      this.aiScenarios.set(scenarios);
    } catch {
      // Silently fail; the scenario picker will stay empty
    } finally {
      this.aiScenariosLoading.set(false);
    }
  }

  selectAiScenario(scenario: Scenario | null): void {
    this.aiSelectedScenario.set(scenario);
    this.aiMessages.set([]);
    this.aiError.set('');
  }

  async sendAiMessage(): Promise<void> {
    const text = this.aiInput().trim();
    if (!text || this.aiLoading()) return;

    // Build conversation history BEFORE adding the user message to avoid duplication
    const conversationHistory = this.aiMessages()
      .slice(-10)
      .map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.text,
      }));

    const userMsg: AiChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: 'user',
      text,
      created_at: new Date(),
    };
    this.aiMessages.update((msgs) => [...msgs, userMsg]);
    this.aiInput.set('');
    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const scenarioId = this.aiSelectedScenario()?.id;
      const { reply: response } = await this.aiConversationService.sendMessage(
        text,
        scenarioId,
        conversationHistory,
      );
      const aiMsg: AiChatMessage = {
        id: `ai-${crypto.randomUUID()}`,
        role: 'ai',
        text: response,
        created_at: new Date(),
      };
      this.aiMessages.update((msgs) => [...msgs, aiMsg]);
    } catch {
      this.aiError.set('aiPartner.error');
    } finally {
      this.aiLoading.set(false);
    }
  }
}
