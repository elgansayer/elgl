import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { UserService, LinkedAccount } from '../../services/user.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private userService = inject(UserService);
  private location = inject(Location);

  readonly isLoading = signal(true);
  readonly isDownloading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly isVip = signal(false);
  readonly primaryAccentColor = signal<string | null>(null);
  readonly interests = signal<string[]>([]);
  newInterest = '';

  readonly availableColors = [
    '#4f46e5', // Indigo (default)
    '#e11d48', // Rose
    '#16a34a', // Green
    '#d97706', // Amber
    '#9333ea', // Purple
    '#0891b2', // Cyan
  ];

  privacyHideLocation = false;
  privacyHideSearch = false;
  privacyHideAge = false;
  privacyHideGender = false;
  autoPlayVoiceNotes = false;
  autoDownloadMedia = false;

  readonly linkedAccounts = signal<LinkedAccount[]>([]);

  /** Providers we support linking */
  readonly supportedProviders = ['google', 'facebook', 'twitter', 'apple'] as const;

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.isVip.set(Boolean(profile.is_vip));
        this.primaryAccentColor.set(profile.primary_accent_color || '#4f46e5');
        this.privacyHideLocation = Boolean(profile.privacy_hide_location);
        this.privacyHideSearch = Boolean(profile.privacy_hide_from_search);
        this.privacyHideAge = Boolean(profile.privacy_hide_age);
        this.privacyHideGender = Boolean(profile.privacy_hide_gender);
        this.autoPlayVoiceNotes = Boolean(profile.auto_play_voice_notes);
        this.autoDownloadMedia = Boolean(profile.auto_download_media);
        this.interests.set(profile.interests ?? []);
      }
      // Load linked accounts
      const accounts = await this.userService.getLinkedAccounts();
      this.linkedAccounts.set(accounts ?? []);
    } catch {
      this.errorMessage.set('Failed to load settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  async linkAccount(provider: string): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.userService.linkAccount(provider);
      const updated = await this.userService.getLinkedAccounts();
      this.linkedAccounts.set(updated ?? []);
      this.successMessage.set(`Linked account (${provider})`);
    } catch {
      this.errorMessage.set(`Failed to link ${provider}`);
    }
  }

  async unlinkAccount(provider: string): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.userService.unlinkAccount(provider);
      const updated = await this.userService.getLinkedAccounts();
      this.linkedAccounts.set(updated ?? []);
      this.successMessage.set(`Unlinked account (${provider})`);
    } catch {
      this.errorMessage.set(`Failed to unlink ${provider}`);
    }
  }

  /** Returns true if the given provider is already linked */
  isLinked(provider: string): boolean {
    return this.linkedAccounts().some((a) => a.provider === provider);
  }

  /** Returns a simple icon (emoji or letter) for a provider */
  providerIcon(provider: string): string {
    const icons: Record<string, string> = {
      google: 'G',
      facebook: 'F',
      twitter: '𝕏',
      apple: '⌘',
    };
    return icons[provider] ?? '?';
  }

  /** Returns the linked account object for a provider if it exists */
  getLinkedAccount(provider: string): LinkedAccount | undefined {
    return this.linkedAccounts().find((a) => a.provider === provider);
  }

  goBack(): void {
    this.location.back();
  }

  setAccentColor(color: string): void {
    if (this.isVip()) {
      this.primaryAccentColor.set(color);
    }
  }

  addInterest(): void {
    const tag = this.newInterest.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag && !this.interests().includes(tag)) {
      this.interests.update(arr => [...arr, tag]);
    }
    this.newInterest = '';
  }

  removeInterest(index: number): void {
    this.interests.update(arr => arr.filter((_, i) => i !== index));
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      await this.userService.updateMyProfile({
        privacy_hide_location: this.privacyHideLocation,
        privacy_hide_from_search: this.privacyHideSearch,
        privacy_hide_age: this.privacyHideAge,
        privacy_hide_gender: this.privacyHideGender,
        auto_play_voice_notes: this.autoPlayVoiceNotes,
        auto_download_media: this.autoDownloadMedia,
        primary_accent_color: this.primaryAccentColor() ?? undefined,
        interests: this.interests(),
      });
      this.successMessage.set('Settings saved successfully');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  async downloadData(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isDownloading.set(true);

    try {
      await this.userService.downloadMyData();
      this.successMessage.set('Data export downloaded successfully');
    } catch {
      this.errorMessage.set('Failed to download data export');
    } finally {
      this.isDownloading.set(false);
    }
  }
}
