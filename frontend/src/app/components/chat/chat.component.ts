import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessageComponent, ChatMessage } from '../chat/chat-message.component';
import { SafetyService } from '../../services/safety.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatMessageComponent],
  template: `
    <div class="flex flex-col space-y-3 p-4">
      @for (msg of visibleMessages(); track msg.id) {
        <app-chat-message
          [message]="msg"
          [currentUserId]="currentUserId()"
        />
      } @empty {
        <div class="text-center text-gray-400 py-8">No messages yet</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class ChatComponent {
  /** All messages (from parent or service) */
  readonly messages = input<ChatMessage[]>([]);
  /** The ID of the currently logged‑in user */
  readonly currentUserId = input<string>('');

  private readonly safetyService = inject(SafetyService);

  /** Only those messages whose sender is NOT in the locally cached blocked list */
  readonly visibleMessages = computed(() => {
    const msgs = this.messages();
    if (!msgs) return [];
    return msgs.filter(m => !this.safetyService.isUserBlockedCached(m.sender_id));
  });
}
