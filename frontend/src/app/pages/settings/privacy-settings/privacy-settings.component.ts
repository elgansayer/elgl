import { Component, inject, signal, resource } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../services/translate.pipe';
import { UserService, UserProfile } from '../../../services/user.service';
import { GdprService } from '../../../services/gdpr.service';
import { I18nService } from '../../../services/i18n.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterModule],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private userService = inject(UserService);
  private gdprService = inject(GdprService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  // Privacy toggles
  readonly privacyHideLocation = signal(false);
  readonly privacyHideSearch = signal(false);
  readonly privacyHideAge = signal(false);
  readonly privacyHideGender = signal(false);
  readonly privacyHideExactLocation = signal(false);
  readonly privacyHideOnlineStatus = signal(false);
  readonly privacyHideVipStatus = signal(false);

  // Profile visibility
  readonly profileVisibility = signal<'everyone' | 'vips_only' | 'hidden'>('everyone');

  // Granular visibility settings (who can see what)
  readonly privacyLastSeen = signal('everyone');
  readonly privacyProfilePhoto = signal('everyone');
  readonly privacyAboutInfo = signal('everyone');
  readonly privacyStatus = signal('everyone');
  readonly incognitoVisits = signal(false);

  // Archive & deletion
  readonly isArchiving = signal(false);
  readonly archiveSuccess = signal(false);

  readonly isVip = signal(false);

  private profileResource = resource<UserProfile | null, void>({
    loader: async () => {
      this.isLoading.set(true);
      try {
        const profile = await this.userService.getMyProfile();
        if (profile) {
          this.isVip.set(Boolean(profile.is_vip));
          this.privacyHideLocation.set(Boolean(profile.privacy_hide_location));
          this.privacyHideSearch.set(Boolean(profile.privacy_hide_from_search));
          this.privacyHideAge.set(Boolean(profile.privacy_hide_age));
          this.privacyHideGender.set(Boolean(profile.privacy_hide_gender));
          this.privacyHideExactLocation.set(Boolean(profile.privacy_hide_exact_location));
          this.privacyHideOnlineStatus.set(Boolean(profile.privacy_hide_online_status));
          this.privacyHideVipStatus.set(Boolean(profile.privacy_hide_vip_status));
          this.profileVisibility.set(this.sanitiseVisibility(profile.profile_visibility));

          this.privacyLastSeen.set(profile.privacy_last_seen ?? 'everyone');
          this.privacyProfilePhoto.set(profile.privacy_profile_photo ?? 'everyone');
          this.privacyAboutInfo.set(profile.privacy_about_info ?? 'everyone');
          this.privacyStatus.set(profile.privacy_status ?? 'everyone');
          this.incognitoVisits.set(Boolean(profile.incognito_visits));
        }
        return profile;
      } catch {
        this.errorMessage.set('Failed to load privacy settings');
        return null;
      } finally {
        this.isLoading.set(false);
      }
    },
  });

  private sanitiseVisibility(value: string | undefined): 'everyone' | 'vips_only' | 'hidden' {
    if (value === 'everyone' || value === 'vips_only' || value === 'hidden') {
      return value;
    }
    return 'everyone';
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      await this.userService.updateMyProfile({
        privacy_hide_location: this.privacyHideLocation(),
        privacy_hide_from_search: this.privacyHideSearch(),
        privacy_hide_age: this.privacyHideAge(),
        privacy_hide_gender: this.privacyHideGender(),
        privacy_hide_exact_location: this.privacyHideExactLocation(),
        privacy_hide_online_status: this.privacyHideOnlineStatus(),
        privacy_hide_vip_status: this.privacyHideVipStatus(),
        profile_visibility: this.profileVisibility(),
        privacy_last_seen: this.privacyLastSeen(),
        privacy_profile_photo: this.privacyProfilePhoto(),
        privacy_about_info: this.privacyAboutInfo(),
        privacy_status: this.privacyStatus(),
        incognito_visits: this.incognitoVisits(),
      });

      await this.userService.updatePrivacySettings({
        privacy_last_seen: this.privacyLastSeen(),
        privacy_profile_photo: this.privacyProfilePhoto(),
        privacy_about_info: this.privacyAboutInfo(),
        privacy_status: this.privacyStatus(),
        incognito_visits: this.incognitoVisits(),
      });

      this.successMessage.set('Privacy settings saved');
    } catch {
      this.errorMessage.set('Failed to save privacy settings');
    } finally {
      this.isSaving.set(false);
    }
  }

  async requestArchive(): Promise<void> {
    this.errorMessage.set('');
    this.isArchiving.set(true);
    try {
      await this.gdprService.requestArchive();
      this.archiveSuccess.set(true);
    } catch {
      this.errorMessage.set('Failed to request data archive');
    } finally {
      this.isArchiving.set(false);
    }
  }

  async downloadMyData(): Promise<void> {
    this.errorMessage.set('');
    try {
      await this.userService.downloadMyData();
      this.successMessage.set('Data export started');
    } catch {
      this.errorMessage.set('Failed to export data');
    }
  }

  goBack(): void {
    this.location.back();
  }
}