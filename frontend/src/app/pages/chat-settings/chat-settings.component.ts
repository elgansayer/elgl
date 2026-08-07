import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatSettingsService } from '../../services/chat-settings.service';

@Component({
  selector: 'app-chat-settings',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="p-4 max-w-md mx-auto space-y-6 bg-[#121212] min-h-screen">
      <h2 class="text-xl font-semibold text-white">{{ 'chat_settings.title' | t }}</h2>

      <!-- Auto-Translate -->
      <div class="bg-[#1e1e1e] rounded-xl p-4 flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-white text-base">{{ 'chat_settings.auto_translate' | t }}</span>
          <span class="text-gray-400 text-sm">{{ 'chat_settings.auto_translate_desc' | t }}</span>
        </div>
        <button
          role="switch"
          [attr.aria-checked]="autoTranslate()"
          [attr.aria-label]="'chat_settings.auto_translate' | t"
          class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0"
          [class.bg-[#00bcd4]]="autoTranslate()"
          [class.bg-gray-600]="!autoTranslate()"
          (click)="toggleAutoTranslate()"
        >
          <span
            class="inline-block h-5 w-5 rounded-full bg-white shadow transition-all"
            [class.translate-x-6]="autoTranslate()"
            [class.translate-x-1]="!autoTranslate()"
          ></span>
        </button>
      </div>

      <!-- Read Receipts -->
      <div class="bg-[#1e1e1e] rounded-xl p-4 flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-white text-base">{{ 'chat_settings.read_receipts' | t }}</span>
          <span class="text-gray-400 text-sm">{{ 'chat_settings.read_receipts_desc' | t }}</span>
        </div>
        <button
          role="switch"
          [attr.aria-checked]="readReceipts()"
          [attr.aria-label]="'chat_settings.read_receipts' | t"
          class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0"
          [class.bg-[#00bcd4]]="readReceipts()"
          [class.bg-gray-600]="!readReceipts()"
          (click)="toggleReadReceipts()"
        >
          <span
            class="inline-block h-5 w-5 rounded-full bg-white shadow transition-all"
            [class.translate-x-6]="readReceipts()"
            [class.translate-x-1]="!readReceipts()"
          ></span>
        </button>
      </div>

      <!-- Enter-to-Send -->
      <div class="bg-[#1e1e1e] rounded-xl p-4 flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-white text-base">{{ 'chat_settings.enter_to_send' | t }}</span>
          <span class="text-gray-400 text-sm">{{ 'chat_settings.enter_to_send_desc' | t }}</span>
        </div>
        <button
          role="switch"
          [attr.aria-checked]="enterToSend()"
          [attr.aria-label]="'chat_settings.enter_to_send' | t"
          class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0"
          [class.bg-[#00bcd4]]="enterToSend()"
          [class.bg-gray-600]="!enterToSend()"
          (click)="toggleEnterToSend()"
        >
          <span
            class="inline-block h-5 w-5 rounded-full bg-white shadow transition-all"
            [class.translate-x-6]="enterToSend()"
            [class.translate-x-1]="!enterToSend()"
          ></span>
        </button>
      </div>

      <!-- Reset to defaults -->
      <div class="mt-8 text-center">
        <button
          class="text-[#00bcd4] text-sm underline decoration-[#00bcd4]"
          (click)="resetToDefaults()"
        >
          {{ 'chat_settings.reset_defaults' | t }}
        </button>
      </div>
    </div>
  `,
})
export class ChatSettingsComponent {
  private settingsService = inject(ChatSettingsService);

  readonly autoTranslate = this.settingsService.autoTranslate;
  readonly readReceipts = this.settingsService.readReceipts;
  readonly enterToSend = this.settingsService.enterToSend;
  readonly loaded = this.settingsService.loaded;

  constructor() {
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

  resetToDefaults(): void {
    this.settingsService.resetToDefaults();
  }
}
