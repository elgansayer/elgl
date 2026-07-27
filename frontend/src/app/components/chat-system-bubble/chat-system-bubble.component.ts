import {
  Component,
  Input,
  inject,
  computed,
} from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-chat-system-bubble',
  standalone: true,
  template: `
    <div class="flex justify-center my-2">
      <span
        class="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded-full dark:bg-gray-800 dark:text-gray-300"
      >
        {{ translatedText() }}
      </span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ChatSystemBubbleComponent {
  @Input({ required: true }) eventType!: string;
  @Input() payload?: Record<string, unknown>;

  private i18n = inject(I18nService);

  private static translations: Record<string, Record<string, string>> = {
    'en-GB': {
      'chat.system.user_joined': 'Someone joined the chat',
      'chat.system.user_left': 'Someone left the chat',
      'chat.system.correction_given': 'A correction was added',
      'chat.system.call_ended': 'The call has ended',
      'chat.system.language_exchange': 'Language exchange moment',
    },
    'en-US': {
      'chat.system.user_joined': 'Someone joined the chat',
      'chat.system.user_left': 'Someone left the chat',
      'chat.system.correction_given': 'A correction was added',
      'chat.system.call_ended': 'The call has ended',
      'chat.system.language_exchange': 'Language exchange moment',
    },
    // Add additional language entries as needed.
  };

  readonly translatedText = computed(() => {
    const lang = this.i18n.currentLang();
    const key = `chat.system.${this.eventType}`;
    const entry =
      ChatSystemBubbleComponent.translations[lang]?.[key] ??
      ChatSystemBubbleComponent.translations['en-GB']?.[key] ??
      `System: ${this.eventType}`;
    return entry;
  });
}
