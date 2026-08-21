import { Component, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'app-message-reaction-bar',
  imports: [...HlmButtonImports],
  template: `
    <div class="mt-1 flex flex-wrap gap-1">
      @for (reaction of getReactionEntries(); track reaction.emoji) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="xs"
          class="rounded-full"
          (click)="toggleReaction(reaction.emoji)"
          [class.bg-primary/20]="reaction.users.includes(currentUserId())"
          [class.text-primary]="reaction.users.includes(currentUserId())"
          [attr.aria-pressed]="reaction.users.includes(currentUserId())"
          [attr.aria-label]="reaction.emoji + ' ' + reaction.users.length"
        >
          <span aria-hidden="true">{{ reaction.emoji }}</span>
          <span>{{ reaction.users.length }}</span>
        </button>
      }
      <div class="ms-1 flex gap-1">
        @for (emoji of quickEmojis; track emoji) {
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-xs"
            class="rounded-full opacity-60 hover:opacity-100"
            (click)="toggleReaction(emoji)"
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
  reacted = output<{ messageId: string; emoji: string; added: boolean }>();

  readonly quickEmojis = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

  getReactionEntries(): Array<{ emoji: string; users: string[] }> {
    if (!this.reactions()) return [];
    return Object.entries(this.reactions()).map(([emoji, users]) => ({ emoji, users }));
  }

  toggleReaction(emoji: string): void {
    const users = this.reactions()?.[emoji] || [];
    const added = !users.includes(this.currentUserId());
    this.reacted.emit({ messageId: this.messageId(), emoji, added });
  }
}
