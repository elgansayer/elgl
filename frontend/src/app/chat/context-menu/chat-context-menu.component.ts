import { Component, input, output, signal, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { FavouriteService } from '../../services/favourite.service';

export interface ChatContextMenuAction {
  id: string;
  labelKey: string;
  role?: 'danger' | 'default';
}

@Component({
  selector: 'app-chat-context-menu',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 bg-black/50 overflow-y-auto"
        tabindex="0"
        (click)="close()"
        (keyup.enter)="close()"
        (keyup.space)="close()"
      >
        <div
          class="fixed bottom-0 start-0 end-0 bg-neutral-900 rounded-t-2xl p-4 shadow-2xl"
          tabindex="0"
          (click)="$event.stopPropagation()"
          (keyup.enter)="$event.stopPropagation()"
          (keyup.space)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between mb-2 ps-1 pe-1">
            <span class="text-lg font-semibold text-neutral-100">{{
              'chat.contextMenu.title' | t
            }}</span>
            <button
              type="button"
              class="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 focus:outline-none"
              (click)="close()"
              [attr.aria-label]="'common.close' | t"
            >
              ✕
            </button>
          </div>

          <div class="divide-y divide-neutral-700/50">
            @for (action of actions(); track action.id) {
              <button
                type="button"
                class="w-full flex items-center gap-3 px-2 py-3 rounded-xl transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                [class.text-red-400]="action.role === 'danger'"
                [class.text-neutral-200]="action.role !== 'danger'"
                (click)="handleAction(action.id)"
              >
                <span class="flex-1 text-start">{{ action.labelKey | t }}</span>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ChatContextMenuComponent {
  readonly message = input.required<ChatMessage>();
  readonly targetLanguage = input<string>('en');
  readonly open = input(false);

  readonly closed = output<void>();
  readonly replyRequested = output<ChatMessage>();
  readonly correctRequested = output<ChatMessage>();
  readonly reportRequested = output<ChatMessage>();
  readonly translateRequested = output<{
    message: ChatMessage;
    targetLanguage: string;
  }>();

  private readonly chatService = inject(ChatService);
  private readonly favouriteService = inject(FavouriteService);

  protected readonly actions = signal<ChatContextMenuAction[]>([
    { id: 'copy', labelKey: 'chat.context.copy' },
    { id: 'translate', labelKey: 'chat.context.translate' },
    { id: 'reply', labelKey: 'chat.context.reply' },
    { id: 'favourite', labelKey: 'chat.context.favourite' },
    { id: 'correct', labelKey: 'chat.context.correct' },
    { id: 'report', labelKey: 'chat.context.report', role: 'danger' },
    { id: 'delete', labelKey: 'chat.context.delete', role: 'danger' },
  ]);

  close(): void {
    this.closed.emit();
  }

  async handleAction(actionId: string): Promise<void> {
    const msg = this.message();
    switch (actionId) {
      case 'copy':
        await this.copyToClipboard(msg.text_content ?? '');
        break;
      case 'translate':
        this.translateRequested.emit({
          message: msg,
          targetLanguage: this.targetLanguage(),
        });
        break;
      case 'reply':
        this.replyRequested.emit(msg);
        break;
      case 'favourite':
        await this.favouriteService.addFavourite({ message_id: msg.id });
        break;
      case 'correct':
        this.correctRequested.emit(msg);
        break;
      case 'report':
        this.reportRequested.emit(msg);
        break;
      case 'delete':
        await this.chatService.deleteMessage(msg.id);
        break;
    }
    this.close();
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }
}
