import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-message-reaction-bar',
  imports: [],
  template: `
    <div class="mt-1 flex flex-wrap gap-1">
      @for (reaction of getReactionEntries(); track reaction.emoji) {
        <button
          (click)="toggleReaction(reaction.emoji)"
          [class]="
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ' +
            (reaction.users.includes(currentUserId())
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-surface-200 text-text-secondary hover:bg-surface-100')
          "
        >
          <span>{{ reaction.emoji }}</span>
          <span>{{ reaction.users.length }}</span>
        </button>
      }
      <div class="flex gap-1 ms-1">
        @for (emoji of quickEmojis; track emoji) {
          <button
            (click)="toggleReaction(emoji)"
            class="flex h-5 w-5 items-center justify-center rounded-full bg-surface-200 text-[12px] opacity-60 hover:bg-surface-100 hover:opacity-100"
          >
            {{ emoji }}
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

  quickEmojis = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

  getReactionEntries() {
    if (!this.reactions()) return [];
    return Object.entries(this.reactions()).map(([emoji, users]) => ({ emoji, users }));
  }

  toggleReaction(emoji: string) {
    const users = this.reactions()?.[emoji] || [];
    const added = !users.includes(this.currentUserId());
    this.reacted.emit({ messageId: this.messageId(), emoji, added });
  }
}
