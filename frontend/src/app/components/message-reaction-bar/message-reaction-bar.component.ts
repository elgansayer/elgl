import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import {
  MESSAGE_REACTION_EMOJIS,
  type MessageReactionEmoji,
} from '../../services/message-reactions.service';

@Component({
  selector: 'app-message-reaction-bar',
  imports: [...HlmButtonImports],
  template: `
    <div
      class="mt-1 flex flex-wrap items-center gap-1"
      role="group"
      [attr.aria-busy]="pending()"
    >
      @for (emoji of quickEmojis; track emoji) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="touch"
          class="min-w-11 rounded-full px-2 opacity-75 hover:opacity-100 focus:opacity-100"
          [disabled]="pending()"
          (click)="toggleReaction(emoji)"
          [class.bg-primary/20]="hasCurrentUserReaction(emoji)"
          [class.text-primary]="hasCurrentUserReaction(emoji)"
          [class.opacity-100]="reactionCount(emoji) > 0"
          [attr.aria-pressed]="hasCurrentUserReaction(emoji)"
          [attr.aria-label]="emoji + ' ' + reactionCount(emoji)"
        >
          <span aria-hidden="true">{{ emoji }}</span>
          @if (reactionCount(emoji) > 0) {
            <span class="tabular-nums" aria-hidden="true">{{ reactionCount(emoji) }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class MessageReactionBarComponent {
  reactions = input<Record<string, string[]>>({});
  currentUserId = input('');
  messageId = input('');
  pending = input(false);
  reacted = output<{ messageId: string; emoji: MessageReactionEmoji; added: boolean }>();

  readonly quickEmojis = MESSAGE_REACTION_EMOJIS;

  getReactionEntries(): Array<{ emoji: MessageReactionEmoji; users: string[] }> {
    const reactions = this.reactions();
    return MESSAGE_REACTION_EMOJIS.flatMap((emoji) => {
      const users = reactions[emoji] ?? [];
      return users.length > 0 ? [{ emoji, users }] : [];
    });
  }

  reactionCount(emoji: MessageReactionEmoji): number {
    return this.reactions()[emoji]?.length ?? 0;
  }

  hasCurrentUserReaction(emoji: MessageReactionEmoji): boolean {
    return (this.reactions()[emoji] ?? []).includes(this.currentUserId());
  }

  toggleReaction(emoji: MessageReactionEmoji): void {
    if (this.pending()) return;
    const added = !this.hasCurrentUserReaction(emoji);
    this.reacted.emit({ messageId: this.messageId(), emoji, added });
  }
}
