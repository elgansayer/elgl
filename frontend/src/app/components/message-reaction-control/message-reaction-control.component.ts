import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';
import {
  MessageReactionsService,
  type MessageReactionEmoji,
} from '../../services/message-reactions.service';
import { MessageReactionBarComponent } from '../message-reaction-bar/message-reaction-bar.component';

@Component({
  selector: 'app-message-reaction-control',
  imports: [MessageReactionBarComponent, TranslatePipe],
  template: `
    @if (currentUserId()) {
      <div
        class="mt-1 flex min-w-0"
        [class.justify-end]="senderId() === currentUserId()"
        [class.justify-start]="senderId() !== currentUserId()"
      >
        <div class="max-w-full">
          <app-message-reaction-bar
            [messageId]="messageId()"
            [currentUserId]="currentUserId() ?? ''"
            [reactions]="reactionRecord()"
            [pending]="pending()"
            (reacted)="onReaction($event)"
          />
          @if (failed()) {
            <p role="alert" class="mt-1 text-xs text-danger">
              {{ 'common.error_generic' | t }}
            </p>
          }
        </div>
      </div>
    }
  `,
})
export class MessageReactionControlComponent implements OnInit, OnDestroy {
  readonly roomId = input.required<string>();
  readonly messageId = input.required<string>();
  readonly senderId = input.required<string>();

  private readonly auth = inject(AuthService);
  private readonly reactions = inject(MessageReactionsService);
  readonly pending = signal(false);
  readonly failed = signal(false);
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);
  readonly reactionRecord = computed<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {};
    for (const reaction of this.reactions.reactionsForMessage(this.roomId(), this.messageId())) {
      (grouped[reaction.emoji] ??= []).push(reaction.user_id);
    }
    return grouped;
  });

  ngOnInit(): void {
    this.reactions.acquireRoom(this.roomId());
  }

  ngOnDestroy(): void {
    this.reactions.releaseRoom(this.roomId());
  }

  async onReaction(event: {
    messageId: string;
    emoji: MessageReactionEmoji;
    added: boolean;
  }): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    this.failed.set(false);
    try {
      await this.reactions.setReaction(event.messageId, event.emoji, event.added, this.roomId());
    } catch {
      this.failed.set(true);
    } finally {
      this.pending.set(false);
    }
  }
}
