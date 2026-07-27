import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ChatMessage } from '../../../services/chat.service';

@Component({
  standalone: true,
  selector: 'app-system-message-bubble',
  imports: [TranslatePipe],
  template: `
    <div class="flex justify-center my-2">
      <div
        class="bg-indigo-100/70 dark:bg-indigo-800/30 rounded-full px-4 py-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium"
      >
        {{ (translationKey | translate) || displayFallback }}
      </div>
    </div>
  `,
  styles: [],
})
export class SystemMessageBubbleComponent {
  @Input({ required: true }) message!: ChatMessage;

  get translationKey(): string {
    const systemEvent = this.message.system_event as {
      type?: string;
      [key: string]: unknown;
    };
    if (systemEvent?.type) {
      return `system.${systemEvent.type}`;
    }
    return 'system.unknown';
  }

  get displayFallback(): string {
    const systemEvent = this.message.system_event as {
      type?: string;
      [key: string]: unknown;
    };
    return systemEvent?.type ?? 'unknown event';
  }
}
