import { Component, inject, signal, effect } from '@angular/core';
import { TranslatePipe } from '../../../../services/translate.pipe';
import { SettingsService } from '../../../../core/services/settings.service';

type ProfileVis = 'everyone' | 'vips_only' | 'hidden';
type ImageFilter = 'All' | 'Blurred' | 'None';

interface VisibilityOption {
  readonly value: ProfileVis;
  readonly labelKey: string;
}

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <section class="space-y-4">
      <h2 id="privacy-visibility-heading" class="text-sm font-bold uppercase text-text-secondary tracking-wider">
        {{ 'profile.visibilityLabel' | t }}
      </h2>
      <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm">
        <div class="p-4">
          <p class="text-xs text-text-secondary mb-3">
            {{ 'profile.visibilityDescription' | t }}
          </p>
          <div class="flex gap-2" role="radiogroup" [attr.aria-label]="'profile.visibilityLabel' | t">
            @for (option of visibilityOptions; track option.value) {
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                [class.bg-primary]="profileVis() === option.value"
                [class.text-white]="profileVis() === option.value"
                [class.border-primary]="profileVis() === option.value"
                [class.text-text-primary]="profileVis() !== option.value"
                [class.border-surface-300]="profileVis() !== option.value"
                [attr.aria-pressed]="profileVis() === option.value"
                (click)="setVisibility(option.value)"
              >
                {{ option.labelKey | t }}
              </button>
            }
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h2 id="privacy-dm-heading" class="text-sm font-bold uppercase text-text-secondary tracking-wider">
        {{ 'settings.directMessagesSection' | t }}
      </h2>
      <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm">
        <label
          class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors"
        >
          <span class="text-sm font-medium text-text-primary">{{
            'settings.allowDmFromServerMembers' | t
          }}</span>
          <input
            type="checkbox"
            [checked]="allowDm()"
            (change)="toggleAllowDm()"
            class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30"
          />
        </label>

        <div class="flex items-center justify-between p-4">
          <span class="text-sm font-medium text-text-primary">{{
            'settings.imageFilterLevel' | t
          }}</span>
          <select
            [value]="imageFilter()"
            (change)="setImageFilter($event)"
            class="bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
            [attr.aria-label]="'settings.imageFilterLevel' | t"
          >
            <option value="All">{{ 'settings.imageFilterAll' | t }}</option>
            <option value="Blurred">{{ 'settings.imageFilterBlurred' | t }}</option>
            <option value="None">{{ 'settings.imageFilterNone' | t }}</option>
          </select>
        </div>
      </div>
    </section>
  `,
})
export class PrivacySettingsComponent {
  private settingsService = inject(SettingsService);

  readonly profileVis = signal<ProfileVis>('everyone');
  readonly allowDm = signal(true);
  readonly imageFilter = signal<ImageFilter>('Blurred');

  readonly visibilityOptions: VisibilityOption[] = [
    { value: 'everyone', labelKey: 'profile.visibility.everyone' },
    { value: 'vips_only', labelKey: 'profile.visibility.vipsOnly' },
    { value: 'hidden', labelKey: 'profile.visibility.hidden' },
  ];

  constructor() {
    effect(() => {
      const data = this.settingsService.privacySettings();
      if (data) {
        this.profileVis.set(data.profileVisibility);
        this.allowDm.set(data.directMessages.allowFromServerMembers);
        this.imageFilter.set(data.directMessages.imageFilterLevel);
      }
    });

    const current = this.settingsService.settings();
    if (!current) {
      this.settingsService.loadSettings('current-user');
    }
  }

  setVisibility(value: ProfileVis): void {
    if (value === this.profileVis()) return;
    this.profileVis.set(value);
    this.persist();
  }

  toggleAllowDm(): void {
    this.allowDm.update((v) => !v);
    this.persist();
  }

  setImageFilter(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const val = select.value;
    if (val !== 'All' && val !== 'Blurred' && val !== 'None') return;
    if (val === this.imageFilter()) return;
    this.imageFilter.set(val);
    this.persist();
  }

  private persist(): void {
    this.settingsService.updatePrivacySettings({
      profileVisibility: this.profileVis(),
      directMessages: {
        allowFromServerMembers: this.allowDm(),
        imageFilterLevel: this.imageFilter(),
      },
    });
  }
}
