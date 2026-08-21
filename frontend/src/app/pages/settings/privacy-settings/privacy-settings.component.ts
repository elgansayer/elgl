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

interface HubNavItem {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly route: string;
}

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [HlmInput, HlmButton, FormsModule, TranslatePipe, RouterModule],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private safetyService = inject(SafetyService);
  private blockedUsersService = inject(BlockedUsersService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isLoading = signal(false);
  readonly mutedWordInput = signal('');
  readonly blockedCount = signal(0);
  readonly successMessage = signal('');

  readonly mutedWords = this.safetyService.mutedWords;
  readonly blockedUsers = this.blockedUsersService.blockedUsers;

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
