import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatSettingsService } from '../../services/chat-settings.service';

@Component({
  selector: 'app-chat-settings',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div
      class="mx-auto min-h-screen max-w-md space-y-6 bg-surface-500 p-4"
      [attr.aria-busy]="!loaded() || saving()"
    >
      <h2 class="text-xl font-semibold text-text-primary">{{ 'chat_settings.title' | t }}</h2>

      @if (!loaded()) {
        <div class="py-8 text-center text-text-secondary" role="status" aria-live="polite">
          {{ 'common.loading' | t }}
        </div>
      } @else if (loadFailed()) {
        <div
          class="space-y-3 rounded-card border border-danger/30 bg-danger/10 p-4 text-text-primary"
          role="alert"
        >
          <p>{{ 'common.error' | t }}</p>
          <button hlmBtn type="button" class="min-h-11" (click)="retryLoad()">
            {{ 'common.retry' | t }}
          </button>
        </div>
      } @else {
        @if (saveFailed()) {
          <p
            class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-text-primary"
            role="alert"
          >
            {{ 'common.error' | t }}
          </p>
        }

        <div class="flex flex-col gap-3 rounded-card bg-surface-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <span class="block break-words text-base text-text-primary">{{
              'chat_settings.auto_translate' | t
            }}</span>
            <span class="block break-words text-sm text-text-secondary">{{
              'chat_settings.auto_translate_desc' | t
            }}</span>
          </div>
          <button
            hlmBtn
            type="button"
            role="switch"
            [attr.aria-checked]="autoTranslate()"
            [attr.aria-label]="'chat_settings.auto_translate' | t"
            [disabled]="saving()"
            class="relative inline-flex h-11 w-14 shrink-0 items-center rounded-full px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            [class.justify-end]="autoTranslate()"
            [class.justify-start]="!autoTranslate()"
            [class.bg-primary]="autoTranslate()"
            [class.bg-surface-300]="!autoTranslate()"
            (click)="toggleAutoTranslate()"
          >
            <span class="block h-6 w-6 rounded-full bg-on-fill shadow" aria-hidden="true"></span>
          </button>
        </div>

        <div class="flex flex-col gap-3 rounded-card bg-surface-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <span class="block break-words text-base text-text-primary">{{
              'chat_settings.read_receipts' | t
            }}</span>
            <span class="block break-words text-sm text-text-secondary">{{
              'chat_settings.read_receipts_desc' | t
            }}</span>
          </div>
          <button
            hlmBtn
            type="button"
            role="switch"
            [attr.aria-checked]="readReceipts()"
            [attr.aria-label]="'chat_settings.read_receipts' | t"
            [disabled]="saving()"
            class="relative inline-flex h-11 w-14 shrink-0 items-center rounded-full px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            [class.justify-end]="readReceipts()"
            [class.justify-start]="!readReceipts()"
            [class.bg-primary]="readReceipts()"
            [class.bg-surface-300]="!readReceipts()"
            (click)="toggleReadReceipts()"
          >
            <span class="block h-6 w-6 rounded-full bg-on-fill shadow" aria-hidden="true"></span>
          </button>
        </div>

        <div class="flex flex-col gap-3 rounded-card bg-surface-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <span class="block break-words text-base text-text-primary">{{
              'chat_settings.enter_to_send' | t
            }}</span>
            <span class="block break-words text-sm text-text-secondary">{{
              'chat_settings.enter_to_send_desc' | t
            }}</span>
          </div>
          <button
            hlmBtn
            type="button"
            role="switch"
            [attr.aria-checked]="enterToSend()"
            [attr.aria-label]="'chat_settings.enter_to_send' | t"
            [disabled]="saving()"
            class="relative inline-flex h-11 w-14 shrink-0 items-center rounded-full px-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            [class.justify-end]="enterToSend()"
            [class.justify-start]="!enterToSend()"
            [class.bg-primary]="enterToSend()"
            [class.bg-surface-300]="!enterToSend()"
            (click)="toggleEnterToSend()"
          >
            <span class="block h-6 w-6 rounded-full bg-on-fill shadow" aria-hidden="true"></span>
          </button>
        </div>

        @if (saving()) {
          <p class="text-center text-sm text-text-secondary" role="status" aria-live="polite">
            {{ 'common.saving' | t }}
          </p>
        }

        <div class="mt-8 text-center">
          <button
            hlmBtn
            type="button"
            data-testid="reset-chat-settings"
            class="min-h-11 text-sm text-primary underline decoration-primary disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="saving()"
            (click)="resetToDefaults()"
          >
            {{ 'chat_settings.reset_defaults' | t }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ChatSettingsComponent {
  private readonly settingsService = inject(ChatSettingsService);

  readonly autoTranslate = this.settingsService.autoTranslate;
  readonly readReceipts = this.settingsService.readReceipts;
  readonly enterToSend = this.settingsService.enterToSend;
  readonly loaded = this.settingsService.loaded;
  readonly loadFailed = this.settingsService.loadFailed;
  readonly saving = this.settingsService.saving;
  readonly saveFailed = signal(false);

  constructor() {
    void this.settingsService.loadSettings();
  }

  async retryLoad(): Promise<void> {
    this.saveFailed.set(false);
    await this.settingsService.loadSettings();
  }

  async toggleAutoTranslate(): Promise<void> {
    await this.updateSetting('autoTranslate', !this.autoTranslate());
  }

  async toggleReadReceipts(): Promise<void> {
    await this.updateSetting('readReceipts', !this.readReceipts());
  }

  async toggleEnterToSend(): Promise<void> {
    await this.updateSetting('enterToSend', !this.enterToSend());
  }

  async resetToDefaults(): Promise<void> {
    this.saveFailed.set(false);
    const saved = await this.settingsService.resetToDefaults();
    this.saveFailed.set(!saved);
  }

  private async updateSetting(
    key: 'autoTranslate' | 'readReceipts' | 'enterToSend',
    value: boolean,
  ): Promise<void> {
    this.saveFailed.set(false);
    const saved = await this.settingsService.updateSetting(key, value);
    this.saveFailed.set(!saved);
  }
}
