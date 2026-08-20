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
import { PrivacyStatusService } from '../../../services/privacy-status.service';

interface HubNavItem {
  readonly icon: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly route: string;
}

type PrivacyControl = 'online' | 'vip';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [HlmInput, HlmButton, FormsModule, TranslatePipe, RouterModule],
  templateUrl: './privacy-settings.component.html',
})
export class PrivacySettingsComponent {
  private safetyService = inject(SafetyService);
  private blockedUsersService = inject(BlockedUsersService);
  private privacyStatusService = inject(PrivacyStatusService);
  private location = inject(Location);
  readonly i18nService = inject(I18nService);

  readonly isLoading = signal(false);
  readonly mutedWordInput = signal('');
  readonly blockedCount = signal(0);
  readonly successMessage = signal('');

  readonly privacyControlsLoading = signal(true);
  readonly privacyControlsError = signal('');
  readonly privacyControlsStatus = signal('');
  readonly savingPrivacyControl = signal<PrivacyControl | null>(null);
  readonly hideOnlineStatus = signal(false);
  readonly hideVipStatus = signal(false);

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
    void this.loadPrivacyControls();
  }

  private loadCounts(): void {
    this.blockedUsersService.loadBlockedUsers().then(() => {
      this.blockedCount.set(this.blockedUsers().length);
    });
  }

  async loadPrivacyControls(): Promise<void> {
    this.privacyControlsLoading.set(true);
    this.privacyControlsError.set('');
    try {
      const controls = await this.privacyStatusService.load();
      this.hideOnlineStatus.set(controls.hideOnlineStatus);
      this.hideVipStatus.set(controls.hideVipStatus);
    } catch {
      this.privacyControlsError.set(
        'Could not load visibility controls. Your existing privacy settings have not changed.',
      );
    } finally {
      this.privacyControlsLoading.set(false);
    }
  }

  async setHideOnlineStatus(hidden: boolean): Promise<void> {
    await this.persistPrivacyControl('online', hidden);
  }

  async setHideVipStatus(hidden: boolean): Promise<void> {
    await this.persistPrivacyControl('vip', hidden);
  }

  private async persistPrivacyControl(control: PrivacyControl, hidden: boolean): Promise<void> {
    if (this.savingPrivacyControl()) return;

    const state = control === 'online' ? this.hideOnlineStatus : this.hideVipStatus;
    const previous = state();
    state.set(hidden);
    this.savingPrivacyControl.set(control);
    this.privacyControlsError.set('');
    this.privacyControlsStatus.set('');

    try {
      if (control === 'online') {
        await this.privacyStatusService.setHideOnlineStatus(hidden);
        this.privacyControlsStatus.set(
          hidden ? 'Online status is now hidden.' : 'Online status is now visible.',
        );
      } else {
        await this.privacyStatusService.setHideVipStatus(hidden);
        this.privacyControlsStatus.set(
          hidden ? 'VIP status is now hidden.' : 'VIP status is now visible.',
        );
      }
    } catch {
      state.set(previous);
      this.privacyControlsError.set(
        'Could not save this privacy setting. The previous setting has been restored.',
      );
    } finally {
      this.savingPrivacyControl.set(null);
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
