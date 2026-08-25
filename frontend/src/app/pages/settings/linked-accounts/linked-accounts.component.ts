import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import {
  LinkedAccountsService,
  type LinkableAccountProvider,
  type LinkedAccountProvider,
} from '../../../services/linked-accounts.service';
import { AppButtonSecondaryComponent } from '../../../components/primitives/button-secondary/button-secondary.component';

interface ProviderInfo {
  readonly id: LinkedAccountProvider;
  readonly icon: string;
  readonly colour: string;
  readonly labelKey: string;
  readonly linkable: boolean;
}

@Component({
  selector: 'app-linked-accounts-settings',
  imports: [HlmButton, TranslatePipe, AppButtonSecondaryComponent],
  templateUrl: './linked-accounts.component.html',
  styleUrl: './linked-accounts.component.scss',
})
export class LinkedAccountsComponent {
  private readonly linkedAccountsService = inject(LinkedAccountsService);
  private readonly location = inject(Location);

  readonly loading = signal(false);
  readonly pendingUnlinkProvider = signal<LinkableAccountProvider | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly linkedAccountsResource = resource({
    loader: () => this.linkedAccountsService.getLinkedAccounts(),
  });

  readonly supportedProviders: readonly ProviderInfo[] = [
    {
      id: 'google',
      icon: 'G',
      colour: '#4285F4',
      labelKey: 'settings.linkedAccounts.linkGoogle',
      linkable: true,
    },
    {
      id: 'apple',
      icon: 'A',
      colour: '#64748B',
      labelKey: 'settings.linkedAccounts.linkApple',
      linkable: true,
    },
    {
      id: 'email',
      icon: '@',
      colour: '#059669',
      labelKey: 'settings.linkedAccounts.linkEmail',
      linkable: false,
    },
  ];

  readonly linkedCount = computed(
    () => this.linkedAccountsResource.value()?.filter((account) => account.active).length ?? 0,
  );

  isLinked(provider: LinkedAccountProvider): boolean {
    return (
      this.linkedAccountsResource
        .value()
        ?.some((account) => account.provider === provider && account.active) ?? false
    );
  }

  canUnlink(provider: LinkableAccountProvider): boolean {
    const accounts = this.linkedAccountsResource.value();
    if (!accounts || !this.isLinked(provider)) {
      return false;
    }
    return accounts.filter((account) => account.active).length > 1;
  }

  isLinkable(provider: ProviderInfo): provider is ProviderInfo & { id: LinkableAccountProvider } {
    return provider.linkable && provider.id !== 'email';
  }

  async link(provider: LinkableAccountProvider): Promise<void> {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.pendingUnlinkProvider.set(null);
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

  requestUnlink(provider: LinkableAccountProvider): void {
    if (this.loading() || !this.canUnlink(provider)) {
      return;
    }
    this.errorMessage.set('');
    this.successMessage.set('');
    this.pendingUnlinkProvider.set(provider);
  }

  cancelUnlink(): void {
    if (!this.loading()) {
      this.pendingUnlinkProvider.set(null);
    }
  }

  async confirmUnlink(): Promise<void> {
    const provider = this.pendingUnlinkProvider();
    if (!provider || this.loading() || !this.canUnlink(provider)) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      await this.linkedAccountsService.unlinkAccount(provider);
      this.pendingUnlinkProvider.set(null);
      this.linkedAccountsResource.reload();
      this.successMessage.set('settings.linkedAccounts.unlinkSuccess');
    } catch {
      this.errorMessage.set('settings.linkedAccounts.unlinkFailed');
    } finally {
      this.loading.set(false);
    }
  }

  retryLoad(): void {
    this.errorMessage.set('');
    this.linkedAccountsResource.reload();
  }

  goBack(): void {
    this.location.back();
  }
}
