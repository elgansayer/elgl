import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { LinkedAccountsService, LinkedAccount } from '../../../services/linked-accounts.service';
import { AppButtonSecondaryComponent } from '../../../components/primitives/button-secondary/button-secondary.component';

interface ProviderInfo {
  readonly id: string;
  readonly icon: string;
  readonly colour: string;
  readonly labelKey: string;
}

@Component({
  selector: 'app-linked-accounts-settings',
  imports: [HlmButton, TranslatePipe, AppButtonSecondaryComponent],
  templateUrl: './linked-accounts.component.html',
  styleUrl: './linked-accounts.component.scss',
})
export class LinkedAccountsComponent {
  private linkedAccountsService = inject(LinkedAccountsService);
  private location = inject(Location);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly linkedAccountsResource = resource({
    loader: () => this.linkedAccountsService.getLinkedAccounts(),
  });

  readonly supportedProviders: readonly ProviderInfo[] = [
    { id: 'google', icon: 'G', colour: '#4285F4', labelKey: 'settings.linkedAccounts.linkGoogle' },
    { id: 'apple', icon: 'A', colour: '#A2AAAD', labelKey: 'settings.linkedAccounts.linkApple' },
    { id: 'email', icon: '@', colour: '#34D399', labelKey: 'settings.linkedAccounts.linkEmail' },
    {
      id: 'facebook',
      icon: 'f',
      colour: '#1877F2',
      labelKey: 'settings.linkedAccounts.linkFacebook',
    },
    {
      id: 'twitter',
      icon: 'X',
      colour: '#E5E5E5',
      labelKey: 'settings.linkedAccounts.linkTwitter',
    },
  ];

  readonly linkedCount = computed(
    () => this.linkedAccountsResource.value()?.filter((a) => a.active).length ?? 0,
  );

  isLinked(provider: string): boolean {
    return (
      this.linkedAccountsResource.value()?.some((a) => a.provider === provider && a.active) ?? false
    );
  }

  getLinkedAccount(provider: string): LinkedAccount | undefined {
    return this.linkedAccountsResource.value()?.find((a) => a.provider === provider);
  }

  canUnlink(provider: string): boolean {
    const accounts = this.linkedAccountsResource.value();
    if (!accounts) return false;
    const activeCount = accounts.filter((a) => a.active).length;
    if (activeCount <= 1 && this.isLinked(provider)) return false;
    return this.isLinked(provider);
  }

  async link(provider: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.linkedAccountsService.linkAccount(provider);
      this.linkedAccountsResource.reload();
      this.successMessage.set('settings.linkedAccounts.linkSuccess');
    } catch {
      this.errorMessage.set('settings.linkedAccounts.linkFailed');
    } finally {
      this.loading.set(false);
    }
  }

  async unlink(provider: string): Promise<void> {
    if (!this.canUnlink(provider)) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.linkedAccountsService.unlinkAccount(provider);
      this.linkedAccountsResource.reload();
      this.successMessage.set('settings.linkedAccounts.unlinkSuccess');
    } catch {
      this.errorMessage.set('settings.linkedAccounts.unlinkFailed');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
