import {
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatSettingsService } from '../../services/chat-settings.service';

@Component({
  selector: 'app-chat-settings',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-4 max-w-md mx-auto space-y-6">
      <h2 class="text-xl font-semibold">{{ 'chat_settings.title' | t }}</h2>

      <!-- Auto-Translate -->
      <div class="flex items-center justify-between">
        <span>{{ 'chat_settings.auto_translate' | t }}</span>
        <button aria-label="Toggle auto translate"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition"
          [class.bg-blue-500]="autoTranslate()"
          [class.bg-gray-600]="!autoTranslate()"
          (click)="toggleAutoTranslate()"
          role="switch"
          [attr.aria-checked]="autoTranslate()"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            [class.translate-x-6]="autoTranslate()"
            [class.translate-x-1]="!autoTranslate()"
          ></span>
        </button>
      </div>

      <!-- Read Receipts -->
      <div class="flex items-center justify-between">
        <span>{{ 'chat_settings.read_receipts' | t }}</span>
        <button aria-label="Toggle read receipts"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition"
          [class.bg-blue-500]="readReceipts()"
          [class.bg-gray-600]="!readReceipts()"
          (click)="toggleReadReceipts()"
          role="switch"
          [attr.aria-checked]="readReceipts()"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            [class.translate-x-6]="readReceipts()"
            [class.translate-x-1]="!readReceipts()"
          ></span>
        </button>
      </div>

      <!-- Enter-to-Send -->
      <div class="flex items-center justify-between">
        <span>{{ 'chat_settings.enter_to_send' | t }}</span>
        <button aria-label="Toggle enter to send"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition"
          [class.bg-blue-500]="enterToSend()"
          [class.bg-gray-600]="!enterToSend()"
          (click)="toggleEnterToSend()"
          role="switch"
          [attr.aria-checked]="enterToSend()"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white transition"
            [class.translate-x-6]="enterToSend()"
            [class.translate-x-1]="!enterToSend()"
          ></span>
        </button>
      </div>
    </div>
  `,
})
export class ChatSettingsComponent implements OnInit {
  private settingsService = inject(ChatSettingsService);

  readonly autoTranslate = this.settingsService.autoTranslate;
  readonly readReceipts = this.settingsService.readReceipts;
  readonly enterToSend = this.settingsService.enterToSend;
  readonly loaded = this.settingsService.loaded;

  ngOnInit(): void {
    this.settingsService.loadSettings();
  }

  toggleAutoTranslate(): void {
    this.settingsService.updateSetting('autoTranslate', !this.autoTranslate());
  }

  toggleReadReceipts(): void {
    this.settingsService.updateSetting('readReceipts', !this.readReceipts());
  }

  toggleEnterToSend(): void {
    this.settingsService.updateSetting('enterToSend', !this.enterToSend());
  }
}
