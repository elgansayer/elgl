import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

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

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.isVip.set(Boolean(profile.is_vip));
        this.primaryAccentColor.set(profile.primary_accent_color || '#4f46e5');
        this.privacyHideLocation = Boolean(profile.privacy_hide_location);
        this.privacyHideSearch = Boolean(profile.privacy_hide_from_search);
        this.privacyHideAge = Boolean(profile.privacy_hide_age);
        this.privacyHideGender = Boolean(
          (profile as unknown as Record<string, unknown>)['privacy_hide_gender'],
        );
        this.autoPlayVoiceNotes = Boolean(
          (profile as unknown as Record<string, unknown>)['auto_play_voice_notes'],
        );
      }
    } catch {
      this.errorMessage.set('Failed to load settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  goBack(): void {
    this.location.back();
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
        privacy_hide_location: this.privacyHideLocation,
        privacy_hide_from_search: this.privacyHideSearch,
        privacy_hide_age: this.privacyHideAge,
        privacy_hide_gender: this.privacyHideGender,
        auto_play_voice_notes: this.autoPlayVoiceNotes,
        primary_accent_color: this.primaryAccentColor(),
      } as unknown as Record<string, unknown>);
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
