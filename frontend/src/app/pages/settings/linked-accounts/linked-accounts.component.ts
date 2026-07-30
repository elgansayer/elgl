import { Component, inject, resource, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LinkedAccountsService,
} from '../../../services/linked-accounts.service';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  selector: 'app-linked-accounts',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <h2>{{ 'settings.linkedAccounts.title' | t }}</h2>

    @if (errorMessage()) {
      <div class="text-red-400 mb-2">{{ errorMessage() }}</div>
    }

    @if (linkedAccountsResource.value(); as accounts) {
      <ul>
        @for (account of accounts; track account.provider) {
          <li class="flex items-center py-1">
            <span class="me-2">{{ account.provider }}</span>
            <span
              [class.text-green-400]="account.active"
              [class.text-gray-400]="!account.active"
            >
              {{ account.active
                ? ('settings.linkedAccounts.active' | t)
                : ('settings.linkedAccounts.inactive' | t)
              }}
            </span>
            <button
              (click)="unlink(account.provider)"
              class="ms-2 text-red-400 hover:text-red-600"
              [disabled]="loading()"
              aria-label="Unlink {{ account.provider }}"
            >
              {{ 'settings.linkedAccounts.unlink' | t }}
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="text-gray-400">{{ 'settings.linkedAccounts.none' | t }}</p>
    }

    <div class="flex gap-2 mt-4">
      <button
        (click)="link('google')"
        class="px-4 py-2 bg-surface rounded"
        [disabled]="loading()"
        aria-label="Link Google"
      >
        {{ 'settings.linkedAccounts.linkGoogle' | t }}
      </button>
      <button
        (click)="link('apple')"
        class="px-4 py-2 bg-surface rounded"
        [disabled]="loading()"
        aria-label="Link Apple"
      >
        {{ 'settings.linkedAccounts.linkApple' | t }}
      </button>
      <button
        (click)="link('email')"
        class="px-4 py-2 bg-surface rounded"
        [disabled]="loading()"
        aria-label="Link Email"
      >
        {{ 'settings.linkedAccounts.linkEmail' | t }}
      </button>
    </div>
  `,
})
export class LinkedAccountsComponent {
  private linkedAccountsService = inject(LinkedAccountsService);

  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly linkedAccountsResource = resource({
    loader: () => this.linkedAccountsService.getLinkedAccounts(),
  });

  async link(provider: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.linkedAccountsService.linkAccount(provider);
      this.linkedAccountsResource.reload();
    } catch {
      this.errorMessage.set('Failed to link account');
    } finally {
      this.loading.set(false);
    }
  }

  async unlink(provider: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.linkedAccountsService.unlinkAccount(provider);
      this.linkedAccountsResource.reload();
    } catch {
      this.errorMessage.set('Failed to unlink account');
    } finally {
      this.loading.set(false);
    }
  }
}
