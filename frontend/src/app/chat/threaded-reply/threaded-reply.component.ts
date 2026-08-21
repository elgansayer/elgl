import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-reply-preview',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="ps-4 pe-4 py-2 bg-surface-800 rounded-t-lg border-s-4 border-accent-500">
      <div class="flex items-center gap-2 mb-1">
        @if (parentMessage().sender) {
          <img
            [src]="parentMessage().sender?.avatar_url"
            [alt]="parentMessage().sender?.display_name"
            class="w-6 h-6 rounded-full object-cover"
          />
          <span class="font-semibold text-sm">{{
            parentMessage().sender?.display_name || ('chat.unknown_user' | t)
          }}</span>
        } @else {
          <span class="font-semibold text-sm">{{ 'chat.unknown_user' | t }}</span>
        }
        <button
          hlmBtn
          (click)="cancelReply.emit()"
          class="ms-auto text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          {{ 'chat.cancel_reply' | t }}
        </button>
      </div>
      <p class="ms-8 text-sm text-text-secondary truncate">{{ parentMessage().text_content }}</p>
    </div>
  `,
})
export class ReplyPreviewComponent {
  readonly parentMessage = input.required<ChatMessage>();
  readonly cancelReply = output<void>();
}
