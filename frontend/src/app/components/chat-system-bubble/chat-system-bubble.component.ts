import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-system-bubble',
  imports: [TranslatePipe],
  template: `
    <div class="flex justify-center my-2" role="status">
      <span
        class="px-3 py-1 text-xs font-medium text-text-secondary bg-surface-200 border border-surface-100 rounded-full"
      >
        {{ i18nKey() | t: params() }}
      </span>
    </div>
  `,
})
export class ChatSystemBubbleComponent {
  eventType = input.required<string>();
  params = input<Record<string, unknown>>({});

  readonly i18nKey = computed(() => `system.${this.eventType()}`);
}
