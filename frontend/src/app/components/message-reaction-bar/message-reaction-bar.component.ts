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
      @for (reaction of getReactionEntries(); track reaction.emoji) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="touch"
          class="min-w-11 rounded-full px-2"
          [disabled]="pending()"
          (click)="toggleReaction(reaction.emoji)"
          [class.bg-primary/20]="reaction.users.includes(currentUserId())"
          [class.text-primary]="reaction.users.includes(currentUserId())"
          [attr.aria-pressed]="reaction.users.includes(currentUserId())"
          [attr.aria-label]="reaction.emoji + ' ' + reaction.users.length"
        >
          <span aria-hidden="true">{{ reaction.emoji }}</span>
          <span class="tabular-nums">{{ reaction.users.length }}</span>
        </button>
      }
      <div class="flex flex-wrap gap-1">
        @for (emoji of quickEmojis; track emoji) {
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="touch"
            class="min-w-11 rounded-full px-2 opacity-70 hover:opacity-100 focus:opacity-100"
            [disabled]="pending()"
            (click)="toggleReaction(emoji)"
            [attr.aria-pressed]="hasCurrentUserReaction(emoji)"
            [attr.aria-label]="emoji"
          >
            <span aria-hidden="true">{{ emoji }}</span>
          </button>
        }
      </div>
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

  hasCurrentUserReaction(emoji: MessageReactionEmoji): boolean {
    return (this.reactions()[emoji] ?? []).includes(this.currentUserId());
  }

  toggleReaction(emoji: MessageReactionEmoji): void {
    if (this.pending()) return;
    const added = !this.hasCurrentUserReaction(emoji);
    this.reacted.emit({ messageId: this.messageId(), emoji, added });
  }
}
