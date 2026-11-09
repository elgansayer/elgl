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
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';
import { ChatSettingsService } from '../../../services/chat-settings.service';
import { AppButtonPrimaryComponent } from '../../../components/primitives/button-primary/button-primary.component';

/** The format the backend accepts for `primary_accent_color`. */
const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Shown in the colour inputs while no custom accent is chosen: the Ember default. */
const DEFAULT_ACCENT_COLOUR = '#c65230';

interface AccentOption {
  readonly value: string;
  /** Translation key naming the colour, so the control has a readable accessible name. */
  readonly nameKey: string;
}

@Component({
  selector: 'app-appearance-settings',
  imports: [HlmInput, HlmButton, TranslatePipe, RouterLink, AppButtonPrimaryComponent],
  templateUrl: './appearance-settings.component.html',
})
export class AppearanceSettingsComponent {
  readonly fontScaleService = inject(FontScaleService);
  readonly themeService = inject(ThemeService);
  private readonly userService = inject(UserService);
  private readonly chatSettingsService = inject(ChatSettingsService);
  private readonly location = inject(Location);
  private readonly i18nService = inject(I18nService);

  readonly isSaving = signal(false);
  /** Translation key of the failure to announce; the template resolves it. */
  readonly errorMessage = signal('');
  /** Translation key of the confirmation to announce; the template resolves it. */
  readonly successMessage = signal('');

  /**
   * The profile (VIP entitlement and accent) and the chat settings (chat text size)
   * are the two server-backed inputs. Until both have loaded, the controls that
   * depend on them stay disabled rather than guessing the stored state.
   */
  readonly profileAvailable = signal(false);
  readonly chatSettingsAvailable = signal(false);
  readonly serverSettingsAvailable = computed(
    () => this.profileAvailable() && this.chatSettingsAvailable(),
  );

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

  /** The accent being edited. It is only persisted by `saveSettings`. */
  readonly primaryAccentColor = signal<string | null>(null);
  readonly isVip = signal(false);
  /** The accent the server last confirmed, so an unchanged accent is not written again. */
  private readonly savedAccentColor = signal<string | null>(null);

  /** Relay-coherent alternatives to the default Ember accent - see DESIGN.md's token table. */
  readonly accentOptions: readonly AccentOption[] = [
    { value: '#C65230', nameKey: 'settings.accentEmber' }, // default primary
    { value: '#1A8478', nameKey: 'settings.accentTide' }, // secondary
    { value: '#996F10', nameKey: 'settings.accentGold' }, // VIP gold
    { value: '#CC483C', nameKey: 'settings.accentRaspberry' },
    { value: '#8B6CF0', nameKey: 'settings.accentViolet' },
    { value: '#2FC6D9', nameKey: 'settings.accentCyan' },
  ];

  /**
   * The accent can only be edited when the entitlement and the stored accent are
   * known and a change can actually be saved. Otherwise the control would accept
   * a choice that no save could commit.
   */
  readonly accentEditingEnabled = computed(() => this.serverSettingsAvailable() && this.isVip());

  /** True while the hex field holds text the backend would reject. */
  readonly accentInvalid = computed(() => {
    const accent = this.primaryAccentColor();
    return accent !== null && !HEX_COLOUR_PATTERN.test(accent);
  });
  /** The native colour input only accepts a complete colour, so it ignores a half-typed one. */
  readonly accentPickerValue = computed(() => {
    const accent = this.primaryAccentColor();
    return accent !== null && HEX_COLOUR_PATTERN.test(accent) ? accent : DEFAULT_ACCENT_COLOUR;
  });
  readonly accentFieldValue = computed(() => this.primaryAccentColor() ?? DEFAULT_ACCENT_COLOUR);

  private readonly settingsResource = resource<boolean, void>({
    loader: async () => {
      this.errorMessage.set('');

      const [chatSettingsLoaded, profileLoaded] = await Promise.all([
        this.loadChatTextPreference(),
        this.loadProfile(),
      ]);
      this.chatSettingsAvailable.set(chatSettingsLoaded);
      this.profileAvailable.set(profileLoaded);

      const loaded = chatSettingsLoaded && profileLoaded;
      if (!loaded) {
        this.errorMessage.set('settings.appearanceLoadError');
      }
      return loaded;
    },
  });

  readonly isLoading = computed(() => this.settingsResource.isLoading());
  /** The server-backed settings could not be read, so the page offers a retry. */
  readonly loadFailed = computed(() => !this.isLoading() && !this.serverSettingsAvailable());

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  setTextSize(size: TextSizePreference): void {
    this.fontScaleService.setTextSizePreference(size);
  }

  setChatTextSize(size: ChatTextSizePreference): void {
    // Without the stored value there is nothing to compare or roll back to, and a
    // choice made now could never be saved.
    if (!this.chatSettingsAvailable()) return;
    this.fontScaleService.setChatTextSize(size);
  }

  setAccentColor(color: string): void {
    if (!this.accentEditingEnabled()) return;
    this.primaryAccentColor.set(color);
  }

  onCustomColorChange(event: Event): void {
    if (!this.accentEditingEnabled()) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.primaryAccentColor.set(target.value.trim());
  }

  isAccentSelected(color: string): boolean {
    return this.primaryAccentColor()?.toLowerCase() === color.toLowerCase();
  }

  async saveSettings(): Promise<void> {
    if (this.isSaving()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.serverSettingsAvailable()) {
      this.errorMessage.set('settings.appearanceLoadError');
      return;
    }
    if (this.accentInvalid()) {
      this.errorMessage.set('settings.accentColourInvalid');
      return;
    }

    this.isSaving.set(true);
    try {
      // The accent (profile) and chat text size (chat settings) are separate
      // stores. Saving them independently means one failure never discards the
      // other, and pressing Save again only repeats what is still unsaved.
      const [accentSaved, chatTextSizeSaved] = await Promise.all([
        this.saveAccentColour(),
        this.saveChatTextSize(),
      ]);

      if (accentSaved && chatTextSizeSaved) {
        this.successMessage.set('settings.saved');
      } else {
        this.errorMessage.set('settings.appearanceSaveError');
      }
    } catch {
      this.errorMessage.set('settings.appearanceSaveError');
    } finally {
      this.isSaving.set(false);
    }
  }

  retryLoad(): void {
    this.settingsResource.reload();
  }

  goBack(): void {
    this.location.back();
  }

  private async saveAccentColour(): Promise<boolean> {
    // Custom accents are a VIP entitlement. Without it the stored preference must
    // be neither resubmitted nor applied, so the default accent is restored.
    if (!this.isVip()) {
      this.themeService.resetPrimaryAccentColor();
      return true;
    }

    const accent = this.primaryAccentColor();
    if (accent !== null && accent !== this.savedAccentColor()) {
      try {
        // A refused write must surface as a save error, never as saved state.
        await this.userService.updateMyProfile({ primary_accent_color: accent });
      } catch {
        return false;
      }
      this.savedAccentColor.set(accent);
    }

    if (accent) {
      this.themeService.setPrimaryAccentColor(accent);
    } else {
      this.themeService.resetPrimaryAccentColor();
    }
    return true;
  }

  private async saveChatTextSize(): Promise<boolean> {
    const selected = this.currentChatTextSize();
    if (selected === this.chatSettingsService.textSize()) return true;

    const saved = await this.chatSettingsService.updateSetting('textSize', selected);
    if (!saved) {
      // Show what the server still holds instead of an unsaved choice.
      this.fontScaleService.setChatTextSize(this.chatSettingsService.textSize());
    }
    return saved;
  }

  private async loadChatTextPreference(): Promise<boolean> {
    try {
      const loaded = await this.chatSettingsService.loadSettings();
      if (loaded) {
        this.fontScaleService.setChatTextSize(this.chatSettingsService.textSize());
      }
      return loaded;
    } catch {
      return false;
    }
  }

  private async loadProfile(): Promise<boolean> {
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
        this.savedAccentColor.set(accent);
        this.themeService.loadFromProfile({
          primary_accent_color: accent ?? undefined,
        });
        return true;
      }
    } catch {
      // Handled below: an unreadable profile is reported as unavailable.
    }

    // The entitlement is unknown, so accent editing stays disabled.
    this.isVip.set(false);
    return false;
  }
}
