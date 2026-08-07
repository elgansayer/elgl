import { Component, computed, inject, resource, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../services/translate.pipe';
import { UserService } from '../../../services/user.service';
import { I18nService } from '../../../services/i18n.service';

type VisibilityLevel = 'everyone' | 'contacts' | 'nobody';
type ProfileVisibilityLevel = 'everyone' | 'vips_only' | 'hidden';

interface PrivacySettingsPayload {
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  privacy_hide_gender: boolean;
  privacy_hide_exact_location: boolean;
  privacy_hide_online_status: boolean;
  privacy_hide_vip_status: boolean;
  privacy_last_seen: VisibilityLevel;
  privacy_profile_photo: VisibilityLevel;
  privacy_about_info: VisibilityLevel;
  privacy_status: VisibilityLevel;
  incognito_visits: boolean;
  profile_visibility: ProfileVisibilityLevel;
}

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [TranslatePipe, FormsModule, RouterModule],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private userService = inject(UserService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  // Profile privacy toggles
  readonly privacyHideAge = signal(false);
  readonly privacyHideLocation = signal(false);
  readonly privacyHideExactLocation = signal(false);
  readonly privacyHideSearch = signal(false);
  readonly privacyHideGender = signal(false);
  readonly privacyHideOnlineStatus = signal(false);
  readonly privacyHideVipStatus = signal(false);

  // Visibility selectors
  readonly privacyLastSeen = signal<VisibilityLevel>('everyone');
  readonly privacyProfilePhoto = signal<VisibilityLevel>('everyone');
  readonly privacyAboutInfo = signal<VisibilityLevel>('everyone');
  readonly privacyStatus = signal<VisibilityLevel>('everyone');
  readonly profileVisibility = signal<ProfileVisibilityLevel>('everyone');

  // VIP-only
  readonly incognitoVisits = signal(false);

  readonly isVip = signal(false);

  readonly visibilityOptions: VisibilityLevel[] = ['everyone', 'contacts', 'nobody'];
  readonly profileVisibilityOptions: ProfileVisibilityLevel[] = ['everyone', 'vips_only', 'hidden'];

  private privacyResource = resource({
    loader: async () => {
      try {
        const settings = await this.userService.getMyPrivacySettings();
        this.privacyHideAge.set(settings.privacy_hide_age);
        this.privacyHideLocation.set(settings.privacy_hide_location);
        this.privacyHideExactLocation.set(settings.privacy_hide_exact_location);
        this.privacyHideSearch.set(settings.privacy_hide_from_search);
        this.privacyHideGender.set(settings.privacy_hide_gender);
        this.privacyHideOnlineStatus.set(settings.privacy_hide_online_status);
        this.privacyHideVipStatus.set(settings.privacy_hide_vip_status);
        this.privacyLastSeen.set(this.sanitiseVisibility(settings.privacy_last_seen));
        this.privacyProfilePhoto.set(this.sanitiseVisibility(settings.privacy_profile_photo));
        this.privacyAboutInfo.set(this.sanitiseVisibility(settings.privacy_about_info));
        this.privacyStatus.set(this.sanitiseVisibility(settings.privacy_status));
        this.incognitoVisits.set(settings.incognito_visits ?? false);
        this.profileVisibility.set(this.sanitiseProfileVisibility(settings.profile_visibility));

        // Load VIP status from profile
        const profile = await this.userService.getMyProfile();
        if (profile) {
          this.isVip.set(Boolean(profile.is_vip));
        }
        return settings;
      } catch {
        this.errorMessage.set('privacy.loadError');
        return null;
      }
    },
  });

  readonly isLoading = computed(() => this.privacyResource.isLoading());

  readonly hasChanges = computed(() => {
    const s = this.privacyResource.value();
    if (!s) return false;
    return (
      this.privacyHideAge() !== s.privacy_hide_age ||
      this.privacyHideLocation() !== s.privacy_hide_location ||
      this.privacyHideExactLocation() !== s.privacy_hide_exact_location ||
      this.privacyHideSearch() !== s.privacy_hide_from_search ||
      this.privacyHideGender() !== s.privacy_hide_gender ||
      this.privacyHideOnlineStatus() !== s.privacy_hide_online_status ||
      this.privacyHideVipStatus() !== s.privacy_hide_vip_status ||
      this.privacyLastSeen() !== this.sanitiseVisibility(s.privacy_last_seen) ||
      this.privacyProfilePhoto() !== this.sanitiseVisibility(s.privacy_profile_photo) ||
      this.privacyAboutInfo() !== this.sanitiseVisibility(s.privacy_about_info) ||
      this.privacyStatus() !== this.sanitiseVisibility(s.privacy_status) ||
      this.incognitoVisits() !== Boolean(s.incognito_visits) ||
      this.profileVisibility() !== this.sanitiseProfileVisibility(s.profile_visibility)
    );
  });

  private sanitiseVisibility(value: string | undefined): VisibilityLevel {
    if (value === 'everyone' || value === 'contacts' || value === 'nobody') return value;
    return 'everyone';
  }

  private sanitiseProfileVisibility(value: string | undefined): ProfileVisibilityLevel {
    if (value === 'everyone' || value === 'vips_only' || value === 'hidden') return value;
    return 'everyone';
  }

  visibilityLabel(value: VisibilityLevel): string {
    const map: Record<VisibilityLevel, string> = {
      everyone: 'privacy.visibility.everyone',
      contacts: 'privacy.visibility.contacts',
      nobody: 'privacy.visibility.nobody',
    };
    return map[value];
  }

  setLastSeenVisibility(value: VisibilityLevel): void {
    this.privacyLastSeen.set(value);
  }

  setProfilePhotoVisibility(value: VisibilityLevel): void {
    this.privacyProfilePhoto.set(value);
  }

  setAboutInfoVisibility(value: VisibilityLevel): void {
    this.privacyAboutInfo.set(value);
  }

  setStatusVisibility(value: VisibilityLevel): void {
    this.privacyStatus.set(value);
  }

  setProfileVisibility(value: ProfileVisibilityLevel): void {
    this.profileVisibility.set(value);
  }

  goBack(): void {
    this.location.back();
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      const payload: PrivacySettingsPayload = {
        privacy_hide_age: this.privacyHideAge(),
        privacy_hide_location: this.privacyHideLocation(),
        privacy_hide_exact_location: this.privacyHideExactLocation(),
        privacy_hide_from_search: this.privacyHideSearch(),
        privacy_hide_gender: this.privacyHideGender(),
        privacy_hide_online_status: this.privacyHideOnlineStatus(),
        privacy_hide_vip_status: this.privacyHideVipStatus(),
        privacy_last_seen: this.privacyLastSeen(),
        privacy_profile_photo: this.privacyProfilePhoto(),
        privacy_about_info: this.privacyAboutInfo(),
        privacy_status: this.privacyStatus(),
        incognito_visits: this.incognitoVisits(),
        profile_visibility: this.profileVisibility(),
      };
      await this.userService.updateMyProfile(payload);
      this.privacyResource.reload();
      this.successMessage.set('privacy.success');
    } catch {
      this.errorMessage.set('privacy.error');
    } finally {
      this.isSaving.set(false);
    }
  }
}
