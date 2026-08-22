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
import { MutedWordsApiService } from '../../../services/muted-words-api.service';
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
  private mutedWordsApi = inject(MutedWordsApiService);
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
  readonly mutedWordsLoading = signal(true);
  readonly mutedWordsSaving = signal(false);
  readonly mutedWordsError = signal(false);

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
    void this.loadMutedWords();
  }

  private loadCounts(): void {
    this.blockedUsersService.loadBlockedUsers().then(() => {
      this.blockedCount.set(this.blockedUsers().length);
    });
  }

  private syncMutedWords(words: readonly string[]): void {
    this.safetyService.clearMutedWords();
    for (const word of words) {
      this.safetyService.addMutedWord(word);
    }
  }

  async loadMutedWords(): Promise<void> {
    this.mutedWordsLoading.set(true);
    this.mutedWordsError.set(false);
    try {
      this.syncMutedWords(await this.mutedWordsApi.list());
    } catch {
      // Keep the account-scoped local cache active while offline. It is a fallback,
      // not the source of truth, so a visible retry state remains on screen.
      this.mutedWordsError.set(true);
    } finally {
      this.mutedWordsLoading.set(false);
    }
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

  retryMutedWordsLoad(): void {
    void this.loadMutedWords();
  }

  async addMutedWord(): Promise<void> {
    if (this.mutedWordsSaving()) return;
    const word = this.mutedWordInput().normalize('NFKC').trim().toLowerCase();
    if (!word || word.length > 64) return;
    if (this.mutedWords().includes(word)) {
      this.mutedWordInput.set('');
      return;
    }

    this.mutedWordsSaving.set(true);
    this.mutedWordsError.set(false);
    try {
      const words = await this.mutedWordsApi.add(word);
      this.syncMutedWords(words);
      this.mutedWordInput.set('');
    } catch {
      this.mutedWordsError.set(true);
    } finally {
      this.mutedWordsSaving.set(false);
    }
  }

  async removeMutedWord(word: string): Promise<void> {
    if (this.mutedWordsSaving()) return;
    this.mutedWordsSaving.set(true);
    this.mutedWordsError.set(false);
    try {
      this.syncMutedWords(await this.mutedWordsApi.remove(word));
    } catch {
      this.mutedWordsError.set(true);
    } finally {
      this.mutedWordsSaving.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
