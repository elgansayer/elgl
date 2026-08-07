<<<<<<< HEAD
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
=======
import { Component, computed, inject, signal, resource } from '@angular/core';
>>>>>>> origin/main
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FontScaleService } from '../../../services/font-scale.service';
import { Theme, ThemeService } from '../../../services/theme.service';
<<<<<<< HEAD
import { UserService } from '../../../services/user.service';
=======
import { UserService, UserProfile } from '../../../services/user.service';
>>>>>>> origin/main
import { I18nService } from '../../../services/i18n.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
<<<<<<< HEAD
  imports: [TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-50">
      <header class="sticky top-0 z-10 flex items-center justify-between bg-surface-100 ps-4 pe-4 pt-4 pb-4 border-b border-surface-200">
        <div class="flex items-center gap-3">
          <button (click)="goBack()" class="p-2 -ms-2 rounded-full hover:bg-surface-200 transition-colors" [attr.aria-label]="'common.back' | t">
            <span class="text-xl">&#8592;</span>
          </button>
          <h1 class="text-xl font-bold text-text-primary">{{ 'settings.appearanceSection' | t }}</h1>
        </div>
      </header>

      <main class="max-w-3xl mx-auto ps-4 pe-4 pt-6 pb-20 space-y-8">
        @if (errorMessage()) {
          <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm mb-6">{{ successMessage() }}</div>
        }
        @if (profileError()) {
          <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6">{{ 'settings.loadProfileError' | t }}</div>
        }

        <!-- Theme -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">{{ 'appearance.themeLabel' | t }}</h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 shadow-sm p-4">
            <div class="flex gap-2">
              @for (opt of themeOptions; track opt) {
                <button (click)="setTheme(opt)" class="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                  [class.bg-primary]="currentTheme() === opt" [class.text-white]="currentTheme() === opt"
                  [class.bg-surface-200]="currentTheme() !== opt" [class.text-text-primary]="currentTheme() !== opt">
                  {{ ('theme.' + opt) | t }}
                </button>
              }
            </div>
          </div>
        </section>

        <!-- Language -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">{{ 'appearance.languageLabel' | t }}</h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 shadow-sm">
            <select [value]="currentLang()" (change)="onLanguageChange($event)"
              class="w-full bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary rounded-2xl">
              @for (lang of availableLanguages; track lang.code) {
                <option [value]="lang.code">{{ lang.flag }} {{ lang.nativeName }}</option>
              }
            </select>
          </div>
        </section>

        <!-- Font Scale -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">{{ 'settings.fontSize' | t }}</h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 shadow-sm p-6">
            <div class="flex justify-between items-center mb-4 text-text-secondary">
              <span class="text-xs">A</span><span class="text-sm">A</span><span class="text-lg">A</span>
            </div>
            <input type="range" min="80" max="120" step="5" [value]="fontScale()" (input)="onFontScaleChange($event)"
              class="w-full h-2 bg-surface-300 rounded-lg appearance-none cursor-pointer accent-primary"
              [attr.aria-label]="'settings.fontScale' | t" />
            <div class="text-center mt-4"><span class="text-sm font-medium text-text-primary">{{ fontScale() }}%</span></div>
          </div>
        </section>

        <!-- Accent Colour -->
        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">{{ 'settings.accentColor' | t }}</h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm ps-4 pe-4 pt-4 pb-4 space-y-4">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-sm font-medium text-text-primary block">{{ 'settings.accentColor' | t }}</span>
                <span class="text-xs text-text-secondary">{{ 'settings.accentColorDesc' | t }}</span>
              </div>
              @if (!isVip()) {
                <span class="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">{{ 'settings.vipRequired' | t }}</span>
              }
            </div>
            <div class="flex gap-3 flex-wrap">
              @for (colour of availableColours; track colour.value) {
                <button type="button" (click)="setAccentColour(colour.value)" [disabled]="!isVip()"
                  [style.backgroundColor]="colour.value"
                  class="w-10 h-10 rounded-full border-2 transition-transform"
                  [class.border-white]="selectedAccentColor() === colour.value"
                  [class.border-transparent]="selectedAccentColor() !== colour.value"
                  [class.scale-110]="selectedAccentColor() === colour.value"
                  [class.opacity-50]="!isVip()" [class.cursor-not-allowed]="!isVip()"
                  [attr.aria-label]="colour.label"></button>
              }
            </div>
          </div>
        </section>

        <div class="pt-6">
          <button (click)="saveSettings()" [disabled]="saving()"
            class="w-full app-button-primary py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            @if (saving()) { {{ 'common.loading' | t }} } @else { {{ 'settings.saveBtn' | t }} }
          </button>
        </div>
      </main>
    </div>
  `,
})
export class AppearanceSettingsComponent {
  private fontScaleService = inject(FontScaleService);
  private themeService = inject(ThemeService);
=======
  imports: [TranslatePipe, FormsModule],
  templateUrl: './appearance-settings.component.html',
})
export class AppearanceSettingsComponent {
  readonly fontScaleService = inject(FontScaleService);
  readonly themeService = inject(ThemeService);
>>>>>>> origin/main
  private userService = inject(UserService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

<<<<<<< HEAD
  readonly saving = signal(false);
=======
  readonly isSaving = signal(false);
>>>>>>> origin/main
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly fontScale = computed(() => Math.round(this.fontScaleService.scaleFactor() * 100));
  readonly currentTheme = this.themeService.currentTheme;
<<<<<<< HEAD
  readonly themeOptions: Theme[] = ['light', 'dark', 'system'];
  readonly currentLang = this.i18nService.currentLang;
  readonly availableLanguages = this.i18nService.availableLanguages;

  readonly profileResource = resource({
    loader: () => this.userService.getMyProfile(),
  });

  readonly profileError = computed(() => this.profileResource.error());
  readonly isVip = computed(() => Boolean(this.profileResource.value()?.is_vip));
  readonly selectedAccentColor = signal('#4f46e5');

  readonly availableColours = [
    { value: '#4f46e5', label: 'Indigo' },
    { value: '#e11d48', label: 'Rose' },
    { value: '#16a34a', label: 'Green' },
    { value: '#d97706', label: 'Amber' },
    { value: '#9333ea', label: 'Purple' },
    { value: '#0891b2', label: 'Cyan' },
  ];

  constructor() {
    effect(() => {
      const profile = this.profileResource.value();
      if (profile?.primary_accent_color) {
        this.selectedAccentColor.set(profile.primary_accent_color);
      }
    });
=======

  readonly themeOptions: Theme[] = ['light', 'dark', 'system'];

  readonly primaryAccentColor = signal('#4f46e5');
  readonly isVip = signal(false);

  readonly availableColors = [
    '#4f46e5',
    '#e11d48',
    '#16a34a',
    '#d97706',
    '#9333ea',
    '#0891b2',
  ];

  private profileResource = resource<UserProfile | null, void>({
    loader: async () => {
      try {
        const profile = await this.userService.getMyProfile();
        if (profile) {
          this.isVip.set(Boolean(profile.is_vip));
          this.primaryAccentColor.set(profile.primary_accent_color ?? '#4f46e5');
        }
        return profile;
      } catch {
        this.errorMessage.set('Failed to load profile');
        return null;
      }
    },
  });

  readonly isLoading = computed(() => this.profileResource.isLoading());

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
>>>>>>> origin/main
  }

  onFontScaleChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const percent = Number(target.value);
    if (Number.isNaN(percent)) return;
    this.fontScaleService.setScale(percent / 100);
  }

<<<<<<< HEAD
  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  onLanguageChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.i18nService.setLanguage(target.value);
  }

  setAccentColour(colour: string): void {
    if (!this.isVip()) return;
    this.selectedAccentColor.set(colour);
=======
  setAccentColor(color: string): void {
    if (!this.isVip()) return;
    this.primaryAccentColor.set(color);
>>>>>>> origin/main
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
<<<<<<< HEAD
    this.saving.set(true);

    try {
      await this.userService.updateMyProfile({
        primary_accent_color: this.selectedAccentColor() ?? undefined,
      });

      this.successMessage.set(this.i18nService.translate('settings.saveSuccess'));
=======
    this.isSaving.set(true);

    try {
      await this.userService.updateMyProfile({
        primary_accent_color: this.primaryAccentColor(),
      });
      this.successMessage.set('settings.saved');
>>>>>>> origin/main
    } catch {
      this.errorMessage.set(this.i18nService.translate('settings.saveError'));
    } finally {
<<<<<<< HEAD
      this.saving.set(false);
=======
      this.isSaving.set(false);
>>>>>>> origin/main
    }
  }

  changeUiLanguage(lang: string): void {
    this.i18nService.setLanguage(lang);
  }

  onLanguageSelect(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.i18nService.setLanguage(target.value);
  }

  goBack(): void {
    this.location.back();
  }
}
