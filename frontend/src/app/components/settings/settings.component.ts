import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { CacheService } from '../../services/cache.service';
import { Router, RouterModule } from '@angular/router';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { LinkedAccountsService, LinkedAccount } from '../../services/linked-accounts.service';
@Component({
  selector: 'app-settings',
  imports: [FormsModule, TranslatePipe, RouterModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private cacheService = inject(CacheService);
  private userService = inject(UserService);
  private location = inject(Location);
  private router = inject(Router);
  private chatSettingsService = inject(ChatSettingsService);
  private linkedAccountsService = inject(LinkedAccountsService);

  readonly isLoading = signal(true);
  readonly isDownloading = signal(false);
  readonly isClearingCache = signal(false);
  readonly isDeletingOldMedia = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly isVip = signal(false);
  readonly interests = signal<string[]>([]);
  readonly availableInterests = signal<string[]>([]);

  autoPlayVoiceNotes = false;
  soundEffectsEnabled = false;
  vibrationEnabled = false;

  readonly linkedAccounts = signal<LinkedAccount[]>([]);
  readonly linkedCount = computed(() => this.linkedAccounts().filter(a => a.active).length);
  readonly autoDownloadMedia = signal(false);
  readonly autoDownloadPreference = signal<'wifi' | 'cellular'>('wifi');
  protected chatEnterToSend = signal(false);
  protected chatTextSize = signal<'small' | 'medium' | 'large'>('medium');

  /** Providers we support linking */
  readonly supportedProviders: readonly string[] = ['google', 'facebook', 'twitter', 'apple'];
  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.isVip.set(Boolean(profile.is_vip));
        this.autoPlayVoiceNotes = Boolean(profile.auto_play_voice_notes);
        this.autoDownloadMedia.set(Boolean(profile.auto_download_media));
        this.soundEffectsEnabled = Boolean(profile.sound_effects_enabled);
        this.vibrationEnabled = Boolean(profile.vibration_enabled);
        this.interests.set(profile.interests ?? []);
        this.autoDownloadPreference.set(profile.auto_download_preference ?? 'wifi');
        if (this.autoDownloadMedia() && profile.auto_download_wifi_only === true) {
          this.autoDownloadPreference.set('wifi');
        }
      }

      const accounts = await this.linkedAccountsService.getLinkedAccounts();
      this.linkedAccounts.set(accounts ?? []);

      const available = await this.userService.getAvailableInterests();
      this.availableInterests.set(available);
    } catch {
      this.autoDownloadPreference.set('wifi');
      this.errorMessage.set('Failed to load profile or linked accounts');
    } finally {
      this.isLoading.set(false);
    }

    try {
      await this.chatSettingsService.loadSettings();
      this.chatEnterToSend.set(this.chatSettingsService.enterToSend());
      this.chatTextSize.set(this.chatSettingsService.textSize());
    } catch {
      // keep service defaults
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToMySubscription(): void {
    this.router.navigate(['/my-subscription']);
  }

  toggleInterest(interest: string): void {
    this.interests.update((arr) =>
      arr.includes(interest) ? arr.filter((x) => x !== interest) : [...arr, interest],
    );
  }

  removeInterest(index: number): void {
    this.interests.update((arr) => arr.filter((_, i) => i !== index));
  }

  toggleSoundEffects(): void {
    this.soundEffectsEnabled = !this.soundEffectsEnabled;
  }

  toggleVibration(): void {
    this.vibrationEnabled = !this.vibrationEnabled;
  }

  updateAutoDownloadMode(mode: 'off' | 'wifi' | 'cellular'): void {
    if (mode === 'off') {
      this.autoDownloadMedia.set(false);
    } else {
      this.autoDownloadMedia.set(true);
      this.autoDownloadPreference.set(mode);
    }
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      await this.userService.updateMyProfile({
        auto_play_voice_notes: this.autoPlayVoiceNotes,
        auto_download_media: this.autoDownloadMedia(),
        sound_effects_enabled: this.soundEffectsEnabled,
        vibration_enabled: this.vibrationEnabled,
        auto_download_preference: this.autoDownloadPreference(),
        auto_download_wifi_only:
          this.autoDownloadMedia() && this.autoDownloadPreference() === 'wifi',
        interests: this.interests(),
      });

      await this.chatSettingsService.updateSetting('enterToSend', this.chatEnterToSend());
      await this.chatSettingsService.updateSetting('textSize', this.chatTextSize());

      this.successMessage.set('Settings saved successfully');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  async clearCache(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isClearingCache.set(true);
    try {
      await this.cacheService.clearCache();
      this.successMessage.set('Cache cleared successfully');
    } catch {
      this.errorMessage.set('Failed to clear cache');
    } finally {
      this.isClearingCache.set(false);
    }
  }

  async deleteOldMedia(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isDeletingOldMedia.set(true);
    try {
      await this.cacheService.deleteOldMedia();
      this.successMessage.set('Old media deleted successfully');
    } catch {
      this.errorMessage.set('Failed to delete old media');
    } finally {
      this.isDeletingOldMedia.set(false);
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

  openVersionCheck(): void {
    this.router.navigate(['/version']);
  }
}
