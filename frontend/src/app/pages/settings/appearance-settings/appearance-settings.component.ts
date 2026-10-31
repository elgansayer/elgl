import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal, resource } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
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
import { AppButtonPrimaryComponent } from '../../../components/primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [HlmInput, HlmButton, TranslatePipe, FormsModule, RouterLink, AppButtonPrimaryComponent],
  templateUrl: './appearance-settings.component.html',
})
export class AppearanceSettingsComponent {
  readonly fontScaleService = inject(FontScaleService);
  readonly themeService = inject(ThemeService);
  private userService = inject(UserService);
  private chatSettingsService = inject(ChatSettingsService);
  private location = inject(Location);
  private readonly i18nService = inject(I18nService);

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly fontScalePercent = computed(() => Math.round(this.fontScaleService.scaleFactor() * 100));
  readonly fontScalePercentLabel = computed(() => `${this.fontScalePercent()}%`);
  /**
   * Interface language is chosen on /settings/language, the single owner of that
   * preference, so this page only reflects it. Offering a second picker here
   * would bypass that page's fail-closed loading and rollback.
   */
  readonly currentLanguage = computed(() => {
    const code = this.i18nService.currentLang();
    return (
      this.i18nService.availableLanguages.find((language) => language.code === code) ?? {
        code,
        name: code,
        nativeName: code,
        flag: '🌐',
        isRtl: false,
      }
    );
  });
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
          const isVip = Boolean(profile.is_vip);
          this.isVip.set(isVip);

          // Custom accents are a VIP entitlement. A user who previously had
          // VIP may still have a stored preference after downgrading, but the
          // UI must not apply or resubmit that preference while the entitlement
          // is inactive.
          const accent = isVip ? (profile.primary_accent_color ?? null) : null;
          this.primaryAccentColor.set(accent);
          this.themeService.loadFromProfile({
            primary_accent_color: accent ?? undefined,
          });
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
      const accent = this.isVip() ? this.primaryAccentColor() : null;
      const chatTextSize = this.currentChatTextSize();
      if (this.isVip()) {
        await this.userService.updateMyProfile({
          primary_accent_color: accent ?? undefined,
        });
      } else {
        await this.userService.updateMyProfile({});
      }

      const chatSaved = await this.chatSettingsService.updateSetting('textSize', chatTextSize);
      if (!chatSaved) {
        this.fontScaleService.setChatTextSize(this.chatSettingsService.textSize());
        throw new Error('Chat text size was not persisted');
      }

      if (accent) {
        this.themeService.setPrimaryAccentColor(accent);
      } else {
        this.themeService.resetPrimaryAccentColor();
      }
      this.successMessage.set('settings.saved');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isSaving.set(false);
    }
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
