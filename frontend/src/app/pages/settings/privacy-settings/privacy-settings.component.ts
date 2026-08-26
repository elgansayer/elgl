import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { Component, inject, linkedSignal, resource, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../services/translate.pipe';
import { SafetyService } from '../../../services/safety.service';
import { BlockedUsersService } from '../../../services/blocked-users.service';
import { I18nService } from '../../../services/i18n.service';
import {
  isProfileVisibility,
  ProfileVisibility,
  ProfileVisibilityService,
} from '../../../services/profile-visibility.service';

interface HubNavItem {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly route: string;
}

interface ProfileVisibilityOption {
  readonly value: ProfileVisibility;
  readonly labelKey: string;
  readonly descriptionKey: string;
}

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [
    HlmInput,
    HlmButton,
    HlmRadio,
    HlmRadioGroup,
    FormsModule,
    TranslatePipe,
    RouterModule,
  ],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private safetyService = inject(SafetyService);
  private blockedUsersService = inject(BlockedUsersService);
  private profileVisibilityService = inject(ProfileVisibilityService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isLoading = signal(false);
  readonly mutedWordInput = signal('');
  readonly blockedCount = signal(0);
  readonly successMessage = signal('');
  readonly isVisibilitySaving = signal(false);
  readonly visibilitySaveError = signal(false);
  readonly visibilitySaveSuccess = signal(false);

  readonly mutedWords = this.safetyService.mutedWords;
  readonly blockedUsers = this.blockedUsersService.blockedUsers;

  readonly profileVisibilityResource = resource({
    loader: () => this.profileVisibilityService.getProfileVisibility(),
  });
  readonly profileVisibility = linkedSignal(
    () => this.profileVisibilityResource.value() ?? 'everyone',
  );

  readonly profileVisibilityOptions: readonly ProfileVisibilityOption[] = [
    {
      value: 'everyone',
      labelKey: 'privacy.profileVisibility.everyone',
      descriptionKey: 'privacy.profileVisibility.everyoneDescription',
    },
    {
      value: 'vips_only',
      labelKey: 'privacy.profileVisibility.vipsOnly',
      descriptionKey: 'privacy.profileVisibility.vipsOnlyDescription',
    },
    {
      value: 'hidden',
      labelKey: 'privacy.profileVisibility.hidden',
      descriptionKey: 'privacy.profileVisibility.hiddenDescription',
    },
  ];

  readonly hubNavItems: HubNavItem[] = [
    {
      icon: '\uD83D\uDEAB',
      titleKey: 'privacy.hub.blockedUsers',
      descriptionKey: 'privacy.hub.blockedUsersDesc',
      route: '/blocks',
    },
    {
      icon: '\uD83D\uDCE5',
      titleKey: 'privacy.hub.downloadData',
      descriptionKey: 'privacy.hub.downloadDataDesc',
      route: '/gdpr',
    },
    {
      icon: '\uD83D\uDDD1\uFE0F',
      titleKey: 'privacy.hub.accountDeletion',
      descriptionKey: 'privacy.hub.accountDeletionDesc',
      route: '/account/deletion',
    },
    {
      icon: '\uD83D\uDCCB',
      titleKey: 'privacy.hub.privacyPolicy',
      descriptionKey: 'privacy.hub.privacyPolicyDesc',
      route: '/privacy',
    },
  ];

  constructor() {
    this.loadCounts();
  }

  private loadCounts(): void {
    this.blockedUsersService.loadBlockedUsers().then(() => {
      this.blockedCount.set(this.blockedUsers().length);
    });
  }

  async updateProfileVisibility(value: string): Promise<void> {
    if (!isProfileVisibility(value) || this.isVisibilitySaving()) {
      return;
    }

    const previous = this.profileVisibility();
    if (value === previous) {
      return;
    }

    this.profileVisibility.set(value);
    this.isVisibilitySaving.set(true);
    this.visibilitySaveError.set(false);
    this.visibilitySaveSuccess.set(false);

    try {
      await this.profileVisibilityService.updateProfileVisibility(value);
      this.visibilitySaveSuccess.set(true);
    } catch {
      this.profileVisibility.set(previous);
      this.visibilitySaveError.set(true);
    } finally {
      this.isVisibilitySaving.set(false);
    }
  }

  retryProfileVisibilityLoad(): void {
    this.visibilitySaveError.set(false);
    this.visibilitySaveSuccess.set(false);
    this.profileVisibilityResource.reload();
  }

  addMutedWord(): void {
    const word = this.mutedWordInput().trim().toLowerCase();
    if (!word) return;
    this.safetyService.addMutedWord(word);
    this.mutedWordInput.set('');
  }

  removeMutedWord(word: string): void {
    this.safetyService.removeMutedWord(word);
  }

  goBack(): void {
    this.location.back();
  }
}
