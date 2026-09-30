import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal, resource } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import {
  ChatTextSizePreference,
  FontScaleService,
  TextSizePreference,
} from '../../../services/font-scale.service';
import { Theme, ThemeService } from '../../../services/theme.service';
import { UserService, UserProfile } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';
import { ChatSettingsService } from '../../../services/chat-settings.service';
import { FormsModule } from '@angular/forms';
import { AppSelectComponent } from '../../../components/primitives/select/select.component';
import { AppButtonPrimaryComponent } from '../../../components/primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [
    HlmInput,
    HlmButton,
    TranslatePipe,
    FormsModule,
    AppSelectComponent,
    AppButtonPrimaryComponent,
  ],
  templateUrl: './appearance-settings.component.html',
})
export class AppearanceSettingsComponent {
  readonly fontScaleService = inject(FontScaleService);
  readonly themeService = inject(ThemeService);
  private userService = inject(UserService);
  private chatSettingsService = inject(ChatSettingsService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly fontScalePercent = computed(() => Math.round(this.fontScaleService.scaleFactor() * 100));
  readonly fontScalePercentLabel = computed(() => `${this.fontScalePercent()}%`);
  readonly currentTheme = this.themeService.currentTheme;
  readonly currentTextSize = this.fontScaleService.textSizePreference;
  readonly currentChatTextSize = this.fontScaleService.chatTextSize;

  readonly themeOptions: Theme[] = ['light', 'dark', 'system'];
  readonly textSizeOptions: readonly TextSizePreference[] = ['small', 'normal', 'large'];
  readonly chatTextSizeOptions: readonly ChatTextSizePreference[] = ['small', 'medium', 'large'];

  readonly primaryAccentColor = signal<string | null>(null);
  readonly isVip = signal(false);

  /** Relay-coherent alternatives to the default Ember accent - see DESIGN.md's token table. */
  readonly availableColors = [
    '#C65230', // Ember (default primary)
    '#1A8478', // Tide (secondary)
    '#996F10', // vip gold
    '#CC483C', // accent raspberry-ember
    '#8B6CF0', // neon violet
    '#2FC6D9', // neon cyan
  ];

  private profileResource = resource<UserProfile | null, void>({
    loader: async () => {
      await this.loadChatTextPreference();

      try {
        const profile = await this.userService.getMyProfile();
        if (profile) {
          this.isVip.set(Boolean(profile.is_vip));
          const accent = profile.primary_accent_color ?? null;
          this.primaryAccentColor.set(accent);
          if (accent) {
            this.themeService.setPrimaryAccentColor(accent);
          }
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

  setTextSize(size: TextSizePreference): void {
    this.fontScaleService.setTextSizePreference(size);
  }

  setChatTextSize(size: ChatTextSizePreference): void {
    this.fontScaleService.setChatTextSize(size);
  }

  setAccentColor(color: string): void {
    if (!this.isVip()) return;
    this.primaryAccentColor.set(color);
  }

  onCustomColorChange(event: Event): void {
    if (!this.isVip()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.primaryAccentColor.set(target.value);
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      const accent = this.primaryAccentColor();
      const chatTextSize = this.currentChatTextSize();
      await this.userService.updateMyProfile({
        primary_accent_color: accent ?? undefined,
      });

      const chatSaved = await this.chatSettingsService.updateSetting('textSize', chatTextSize);
      if (!chatSaved) {
        this.fontScaleService.setChatTextSize(this.chatSettingsService.textSize());
        throw new Error('Chat text size was not persisted');
      }

      if (accent) {
        this.themeService.setPrimaryAccentColor(accent);
      }
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

  onLanguageValueChange(value: string): void {
    this.i18nService.setLanguage(value);
  }

  goBack(): void {
    this.location.back();
  }

  private async loadChatTextPreference(): Promise<void> {
    const loaded = await this.chatSettingsService.loadSettings();
    if (loaded) {
      this.fontScaleService.setChatTextSize(this.chatSettingsService.textSize());
    }
  }
}
