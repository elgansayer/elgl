import { Component, computed, inject, signal, resource } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FontScaleService } from '../../../services/font-scale.service';
import { Theme, ThemeService } from '../../../services/theme.service';
import { UserService, UserProfile } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';
import { FormsModule } from '@angular/forms';

const DEFAULT_ACCENT = '#4f46e5';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [TranslatePipe, FormsModule],
  templateUrl: './appearance-settings.component.html',
})
export class AppearanceSettingsComponent {
  readonly fontScaleService = inject(FontScaleService);
  readonly themeService = inject(ThemeService);
  private userService = inject(UserService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly fontScale = computed(() => Math.round(this.fontScaleService.scaleFactor() * 100));
  readonly currentTheme = this.themeService.currentTheme;

  readonly themeOptions: Theme[] = ['light', 'dark', 'system'];

  readonly primaryAccentColor = signal(DEFAULT_ACCENT);
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
          const accent = profile.primary_accent_color ?? DEFAULT_ACCENT;
          this.primaryAccentColor.set(accent);
          this.themeService.setPrimaryAccentColor(accent);
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
  }

  onFontScaleChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const percent = Number(target.value);
    if (Number.isNaN(percent)) return;
    this.fontScaleService.setScale(percent / 100);
  }

  setAccentColor(color: string): void {
    if (!this.isVip()) return;
    this.primaryAccentColor.set(color);
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      await this.userService.updateMyProfile({
        primary_accent_color: this.primaryAccentColor(),
      });
      this.themeService.setPrimaryAccentColor(this.primaryAccentColor());
      this.successMessage.set('settings.saved');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isSaving.set(false);
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
