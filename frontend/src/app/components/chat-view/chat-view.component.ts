import { HlmInput } from '@spartan-ng/helm/input';
import { Component, input, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { MessageReactionBarComponent } from '../message-reaction-bar/message-reaction-bar.component';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { SafetyService } from '../../services/safety.service';
import { DraftService } from '../../services/draft.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import {
  MessageReactionsService,
  parseMessageReactionPublication,
  type MessageReaction,
  type MessageReactionEmoji,
  type MessageReactionState,
} from '../../services/message-reactions.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-view',
  imports: [
    HlmInput,
    FormsModule,
    ChatMessageComponent,
    MessageReactionBarComponent,
    TranslatePipe,
  ],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        @for (msg of filteredMessages(); track msg.id) {
          <div class="min-w-0">
            <app-chat-message
              [message]="msg"
              [currentUserId]="effectiveUserId()"
              (messageBlocked)="onMessageBlocked($event)"
            ></app-chat-message>

            @if (msg.message_type !== 'system' && effectiveUserId()) {
              <div
                class="mt-1 flex min-w-0"
                [class.justify-end]="msg.sender_id === effectiveUserId()"
                [class.justify-start]="msg.sender_id !== effectiveUserId()"
              >
                <div class="max-w-full">
                  <app-message-reaction-bar
                    [messageId]="msg.id"
                    [currentUserId]="effectiveUserId() ?? ''"
                    [reactions]="reactionRecord(msg.id)"
                    [pending]="reactionPendingIds().has(msg.id)"
                    (reacted)="onReaction($event)"
                  />
                  @if (reactionErrorIds().has(msg.id)) {
                    <p role="alert" class="mt-1 text-xs text-danger">
                      {{ 'common.error_generic' | t }}
                    </p>
                  }
                </div>
              </div>
            }
          </div>
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
export class ChatViewComponent implements OnInit, OnDestroy {
  roomId = input.required<string>();
  currentUserId = input<string>();

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private safetyService = inject(SafetyService);
  private draftService = inject(DraftService);
  private messageReactionsService = inject(MessageReactionsService);
  private centrifugeService = inject(CentrifugeService);
  private realtimeChannel: string | null = null;

  messages: ChatMessage[] = [];
  newMessageText = '';

  private blockedUserIds = signal<Set<string>>(new Set<string>());
  private readonly reactionRows = signal<Record<string, MessageReaction[]>>({});
  readonly reactionPendingIds = signal<Set<string>>(new Set<string>());
  readonly reactionErrorIds = signal<Set<string>>(new Set<string>());

  readonly effectiveUserId = computed(
    () => this.currentUserId() ?? this.authService.currentUser()?.id,
  );

  readonly filteredMessages = computed(() => {
    const blocked = this.blockedUserIds();
    if (blocked.size === 0) return this.messages;
    return this.messages.filter((msg) => !blocked.has(msg.sender_id));
  });

  async ngOnInit(): Promise<void> {
    this.realtimeChannel = `chat:${this.roomId()}`;
    this.centrifugeService.subscribe(this.realtimeChannel, (publication) => {
      this.applyReactionPublication(publication);
    });
    void this.centrifugeService.connect();

    await this.loadMessages();
    await Promise.all([this.loadBlockedUsers(), this.loadReactions()]);

    // Restore chat draft for this room
    const draft = this.draftService.loadChatDraft(this.roomId());
    if (draft) {
      this.newMessageText = draft;
    }
  }

  ngOnDestroy(): void {
    if (this.realtimeChannel) {
      this.centrifugeService.unsubscribe(this.realtimeChannel);
    }
  }

  onMessageTextChange(value: string): void {
    this.newMessageText = value;
    this.draftService.saveChatDraft(this.roomId(), value);
  }

  reactionRecord(messageId: string): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    for (const reaction of this.reactionRows()[messageId] ?? []) {
      (grouped[reaction.emoji] ??= []).push(reaction.user_id);
    }
    return grouped;
  }

  async onReaction(event: {
    messageId: string;
    emoji: MessageReactionEmoji;
    added: boolean;
  }): Promise<void> {
    if (this.reactionPendingIds().has(event.messageId)) return;

    this.reactionErrorIds.update((ids) => this.without(ids, event.messageId));
    this.reactionPendingIds.update((ids) => this.withAdded(ids, event.messageId));

    try {
      const state = await this.messageReactionsService.setReaction(
        event.messageId,
        event.emoji,
        event.added,
      );
      this.applyReactionState(state);
    } catch {
      this.reactionErrorIds.update((ids) => this.withAdded(ids, event.messageId));
    } finally {
      this.reactionPendingIds.update((ids) => this.without(ids, event.messageId));
    }
  }

  private applyReactionPublication(value: unknown): void {
    const state = parseMessageReactionPublication(value);
    if (state) this.applyReactionState(state);
  }

  private applyReactionState(state: MessageReactionState): void {
    this.reactionRows.update((rows) => ({
      ...rows,
      [state.message_id]: state.reactions,
    }));
  }

  private async loadMessages(): Promise<void> {
    try {
      this.messages = await this.chatService.getMessages(this.roomId());
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }

  private async loadReactions(): Promise<void> {
    if (!this.effectiveUserId()) return;
    try {
      const state = await this.messageReactionsService.getRoomReactions(this.roomId());
      this.reactionRows.set(state.reactions);
    } catch {
      // Messages remain usable when the reaction sub-resource is unavailable.
      this.reactionRows.set({});
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

  private withAdded(values: Set<string>, value: string): Set<string> {
    const next = new Set(values);
    next.add(value);
    return next;
  }

  private without(values: Set<string>, value: string): Set<string> {
    const next = new Set(values);
    next.delete(value);
    return next;
  }
}
