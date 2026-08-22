import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../services/translate.pipe';
import { SafetyService } from '../../../services/safety.service';
import { BlockedUsersService } from '../../../services/blocked-users.service';
import { I18nService } from '../../../services/i18n.service';
import { ProfileVisibility, UserService } from '../../../services/user.service';

interface HubNavItem {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly route: string;
}

type VisibilityRequestState = 'loading' | 'ready' | 'saving' | 'error';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [HlmInput, HlmButton, FormsModule, TranslatePipe, RouterModule],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private safetyService = inject(SafetyService);
  private blockedUsersService = inject(BlockedUsersService);
  private userService = inject(UserService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly mutedWordInput = signal('');
  readonly blockedCount = signal(0);
  readonly profileVisibility = signal<ProfileVisibility>('everyone');
  readonly visibilityState = signal<VisibilityRequestState>('loading');
  readonly visibilityError = signal('');
  readonly visibilitySuccess = signal('');

  readonly mutedWords = this.safetyService.mutedWords;
  readonly blockedUsers = this.blockedUsersService.blockedUsers;

  readonly visibilityOptions: readonly {
    value: ProfileVisibility;
    labelKey: string;
  }[] = [
    { value: 'everyone', labelKey: 'profile.visibility.everyone' },
    { value: 'vips_only', labelKey: 'profile.visibility.vipsOnly' },
    { value: 'hidden', labelKey: 'profile.visibility.hidden' },
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
    void this.loadProfileVisibility();
  }

  private loadCounts(): void {
    this.blockedUsersService.loadBlockedUsers().then(() => {
      this.blockedCount.set(this.blockedUsers().length);
    });
  }

  async loadProfileVisibility(): Promise<void> {
    this.visibilityState.set('loading');
    this.visibilityError.set('');
    this.visibilitySuccess.set('');

    try {
      this.profileVisibility.set(await this.userService.getProfileVisibility());
      this.visibilityState.set('ready');
    } catch {
      this.visibilityState.set('error');
      this.visibilityError.set('privacy.loadError');
    }
  }

  async setProfileVisibility(next: ProfileVisibility): Promise<void> {
    if (this.visibilityState() === 'saving' || next === this.profileVisibility()) return;

    const previous = this.profileVisibility();
    this.profileVisibility.set(next);
    this.visibilityState.set('saving');
    this.visibilityError.set('');
    this.visibilitySuccess.set('');

    try {
      const persisted = await this.userService.setProfileVisibility(next);
      if ((persisted.profile_visibility ?? next) !== next) {
        throw new Error('Profile visibility was not persisted');
      }
      this.visibilityState.set('ready');
      this.visibilitySuccess.set('privacy.success');
    } catch {
      this.profileVisibility.set(previous);
      this.visibilityState.set('error');
      this.visibilityError.set('privacy.error');
    }
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
