import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  CUSTOM_BOT_TONES,
  CustomBotTone,
  CustomEducationalBot,
  CustomEducationalBotInput,
  DeveloperBotsService,
} from '../../services/developer-bots.service';

@Component({
  selector: 'app-developer-bots',
  imports: [FormsModule, HlmButton, HlmCheckbox, HlmInput, TranslatePipe],
  template: `
    <section class="app-padded space-y-4 rounded-card border border-surface-100 bg-surface-200">
      <header
        class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-3"
      >
        <div>
          <h3 class="text-base font-black text-text-primary">
            {{ 'developerBots.title' | t }}
          </h3>
          <p class="app-muted">{{ 'developerBots.subtitle' | t }}</p>
        </div>
        <button hlmBtn type="button" size="touch" (click)="startCreate()">
          {{ 'developerBots.create' | t }}
        </button>
      </header>

      @if (errorKey(); as key) {
        <p role="alert" class="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger-ink">
          {{ key | t }}
        </p>
      }

      @if (editing()) {
        <form class="space-y-3" (ngSubmit)="save()">
          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'developerBots.name' | t }}</span>
            <input
              hlmInput
              name="botName"
              required
              maxlength="80"
              class="w-full"
              [ngModel]="displayName()"
              (ngModelChange)="displayName.set($event)"
            />
          </label>

          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'developerBots.persona' | t }}</span>
            <textarea
              hlmInput
              name="botPersona"
              required
              maxlength="4000"
              rows="4"
              class="w-full"
              [ngModel]="persona()"
              (ngModelChange)="persona.set($event)"
            ></textarea>
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block text-sm font-medium text-text-primary">
              <span class="mb-1 block">{{ 'developerBots.targetLanguage' | t }}</span>
              <input
                hlmInput
                name="botTargetLanguage"
                required
                maxlength="35"
                placeholder="es"
                class="w-full"
                [ngModel]="targetLanguage()"
                (ngModelChange)="targetLanguage.set($event)"
              />
            </label>

            <label class="block text-sm font-medium text-text-primary">
              <span class="mb-1 block">{{ 'developerBots.tone' | t }}</span>
              <select
                name="botTone"
                class="w-full rounded-app border border-surface-100 bg-surface-300 px-3 py-2 text-sm text-text-primary"
                [ngModel]="tone()"
                (ngModelChange)="tone.set($event)"
              >
                @for (option of tones; track option) {
                  <option [value]="option">{{ 'developerBots.tone.' + option | t }}</option>
                }
              </select>
            </label>
          </div>

          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'developerBots.greeting' | t }}</span>
            <input
              hlmInput
              name="botGreeting"
              maxlength="500"
              class="w-full"
              [ngModel]="greeting()"
              (ngModelChange)="greeting.set($event)"
            />
          </label>

          <div class="flex flex-wrap items-center gap-2">
            <button hlmBtn type="submit" size="touch" [disabled]="saving()">
              {{ (saving() ? 'developerBots.saving' : 'developerBots.save') | t }}
            </button>
            <button
              hlmBtn
              type="button"
              size="touch"
              variant="outline"
              [disabled]="saving()"
              (click)="cancelEdit()"
            >
              {{ 'common.cancel' | t }}
            </button>
          </div>
        </form>
      }

      @if (botsResource.isLoading()) {
        <p class="app-muted">{{ 'common.loading' | t }}</p>
      } @else if (bots().length === 0) {
        <p class="app-muted">{{ 'developerBots.empty' | t }}</p>
      } @else {
        <ul class="space-y-2">
          @for (bot of bots(); track bot.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-2 rounded-card border border-surface-100 bg-surface-300 p-3"
            >
              <div class="min-w-0">
                <p class="font-bold text-text-primary">{{ bot.display_name }}</p>
                <p class="text-xs text-text-secondary">
                  {{ bot.target_language }} · {{ 'developerBots.tone.' + bot.tone | t }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <label class="flex items-center gap-1 text-xs text-text-secondary">
                  <hlm-checkbox
                    [checked]="bot.is_enabled"
                    [aria-label]="'developerBots.enabledAria' | t"
                    (checkedChange)="toggleEnabled(bot, $event)"
                  />
                  {{ 'developerBots.enabled' | t }}
                </label>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  variant="outline"
                  (click)="startEdit(bot)"
                >
                  {{ 'common.edit' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  size="touch"
                  variant="destructive"
                  (click)="remove(bot)"
                >
                  {{ 'common.delete' | t }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DeveloperBotsComponent {
  private readonly botService = inject(DeveloperBotsService);
  private readonly i18n = inject(I18nService);

  readonly tones = CUSTOM_BOT_TONES;
  readonly editing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly displayName = signal('');
  readonly persona = signal('');
  readonly targetLanguage = signal('');
  readonly tone = signal<CustomBotTone>('friendly');
  readonly greeting = signal('');
  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);

  private readonly botsState = signal<CustomEducationalBot[]>([]);
  readonly bots = computed(() => this.botsState());

  readonly botsResource = resource({
    loader: async () => {
      try {
        this.botsState.set(await this.botService.listBots());
        this.errorKey.set(null);
      } catch {
        this.errorKey.set('developerBots.loadError');
      }
      return this.botsState();
    },
  });

  constructor() {
    this.botsResource.reload();
  }

  startCreate(): void {
    this.editing.set(true);
    this.editingId.set(null);
    this.displayName.set('');
    this.persona.set('');
    this.targetLanguage.set('');
    this.tone.set('friendly');
    this.greeting.set('');
    this.errorKey.set(null);
  }

  startEdit(bot: CustomEducationalBot): void {
    this.editing.set(true);
    this.editingId.set(bot.id);
    this.displayName.set(bot.display_name);
    this.persona.set(bot.persona);
    this.targetLanguage.set(bot.target_language);
    this.tone.set(bot.tone);
    this.greeting.set(bot.greeting ?? '');
    this.errorKey.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editingId.set(null);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    const input: CustomEducationalBotInput = {
      display_name: this.displayName().trim(),
      persona: this.persona().trim(),
      target_language: this.targetLanguage().trim(),
      tone: this.tone(),
      greeting: this.greeting().trim(),
    };
    if (!input.display_name || !input.persona || !input.target_language) {
      this.errorKey.set('developerBots.validationError');
      return;
    }

    this.saving.set(true);
    this.errorKey.set(null);
    try {
      const id = this.editingId();
      if (id) {
        const updated = await this.botService.updateBot(id, input);
        this.botsState.update((bots) => bots.map((bot) => (bot.id === id ? updated : bot)));
      } else {
        const created = await this.botService.createBot(input);
        this.botsState.update((bots) => [created, ...bots]);
      }
      this.cancelEdit();
    } catch {
      this.errorKey.set('developerBots.saveError');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleEnabled(bot: CustomEducationalBot, enabled: boolean): Promise<void> {
    try {
      const updated = await this.botService.updateBot(bot.id, {
        is_enabled: enabled,
      });
      this.botsState.update((bots) => bots.map((entry) => (entry.id === bot.id ? updated : entry)));
    } catch {
      this.errorKey.set('developerBots.saveError');
    }
  }

  async remove(bot: CustomEducationalBot): Promise<void> {
    if (!window.confirm(this.i18n.translate('developerBots.deleteConfirm'))) {
      return;
    }
    try {
      await this.botService.deleteBot(bot.id);
      this.botsState.update((bots) => bots.filter((entry) => entry.id !== bot.id));
    } catch {
      this.errorKey.set('developerBots.deleteError');
    }
  }
}
