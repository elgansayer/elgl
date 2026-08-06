import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FontScaleService } from '../../../services/font-scale.service';
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './appearance-settings.component.html'
})
export class AppearanceSettingsComponent {
  private fontScaleService = inject(FontScaleService);
  private userService = inject(UserService);
  private location = inject(Location);
  private i18nService = inject(I18nService);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly fontScale = computed(() => Math.round(this.fontScaleService.scaleFactor() * 100));

  readonly isVip = signal(false);
  readonly primaryAccentColor = signal<string | null>(null);

  readonly availableColors = [
    '#4f46e5', // Indigo (default)
    '#e11d48', // Rose
    '#16a34a', // Green
    '#d97706', // Amber
    '#9333ea', // Purple
    '#0891b2', // Cyan
  ];

  constructor() {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.isVip.set(Boolean(profile.is_vip));
        this.primaryAccentColor.set(profile.primary_accent_color || '#4f46e5');
      }
    } catch {
      this.errorMessage.set('Failed to load profile');
    } finally {
      this.isLoading.set(false);
    }
  }

  onFontScaleChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      const percent = Number(target.value);
      if (!Number.isNaN(percent)) {
        const scale = percent / 100;
        this.fontScaleService.setScale(scale);
      }
    }
  }

  setAccentColor(color: string): void {
    if (this.isVip()) {
      this.primaryAccentColor.set(color);
    }
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      await this.userService.updateMyProfile({
        primary_accent_color: this.primaryAccentColor() ?? undefined,
      });

      this.successMessage.set('Settings saved successfully');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
