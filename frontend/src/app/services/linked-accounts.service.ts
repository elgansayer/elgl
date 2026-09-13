import { Injectable, inject } from '@angular/core';
import type { UserIdentity } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export type LinkedAccountProvider = 'email' | 'google' | 'apple';
export type LinkableAccountProvider = Exclude<LinkedAccountProvider, 'email'>;

export interface LinkedAccount {
  provider: LinkedAccountProvider;
  name?: string;
  active: boolean;
  created_at?: string;
  identity_id?: string;
}

const LINKABLE_PROVIDERS = new Set<LinkableAccountProvider>(['google', 'apple']);
const VISIBLE_PROVIDERS = new Set<LinkedAccountProvider>(['email', 'google', 'apple']);

@Injectable({
  providedIn: 'root',
})
export class LinkedAccountsService {
  private readonly supabase = inject(SupabaseService).getClient();
  private mutationInFlight: Promise<void> | null = null;

  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    const { data, error } = await this.supabase.auth.getUserIdentities();
    if (error) {
      throw new Error('Unable to load linked accounts');
    }

    return (data?.identities ?? [])
      .filter((identity): identity is UserIdentity & { provider: LinkedAccountProvider } =>
        VISIBLE_PROVIDERS.has(identity.provider as LinkedAccountProvider),
      )
      .map((identity) => ({
        provider: identity.provider,
        active: true,
        identity_id: identity.identity_id,
        created_at: identity.created_at,
        name: this.identityDisplayName(identity),
      }));
  }

  async linkAccount(provider: LinkableAccountProvider): Promise<void> {
    this.assertLinkableProvider(provider);
    return this.runExclusive(async () => {
      const identities = await this.getLinkedAccounts();
      if (identities.some((identity) => identity.provider === provider)) {
        return;
      }

      const redirectTo =
        typeof window === 'undefined'
          ? undefined
          : new URL('/settings/linked-accounts', window.location.origin).toString();

      const { error } = await this.supabase.auth.linkIdentity({
        provider,
        ...(redirectTo ? { options: { redirectTo } } : {}),
      });

      if (error) {
        throw new Error('Unable to link account');
      }
    });
  }

  async unlinkAccount(provider: LinkableAccountProvider): Promise<void> {
    this.assertLinkableProvider(provider);
    return this.runExclusive(async () => {
      const { data, error } = await this.supabase.auth.getUserIdentities();
      if (error) {
        throw new Error('Unable to load linked accounts');
      }

      const identities = data?.identities ?? [];
      const identity = identities.find((candidate) => candidate.provider === provider);
      if (!identity) {
        return;
      }
      if (identities.length <= 1) {
        throw new Error('Cannot unlink the last sign-in method');
      }

      const { error: unlinkError } = await this.supabase.auth.unlinkIdentity(identity);
      if (unlinkError) {
        throw new Error('Unable to unlink account');
      }
    });
  }

  private assertLinkableProvider(provider: string): asserts provider is LinkableAccountProvider {
    if (!LINKABLE_PROVIDERS.has(provider as LinkableAccountProvider)) {
      throw new Error('Unsupported linked account provider');
    }
  }

  private identityDisplayName(identity: UserIdentity): string | undefined {
    const data = identity.identity_data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    for (const key of ['email', 'full_name', 'name'] as const) {
      const value = data[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed.slice(0, 200);
        }
      }
    }
    return undefined;
  }

  private async runExclusive(operation: () => Promise<void>): Promise<void> {
    if (this.mutationInFlight) {
      return this.mutationInFlight;
    }

    const pending = operation();
    this.mutationInFlight = pending;
    try {
      await pending;
    } finally {
      if (this.mutationInFlight === pending) {
        this.mutationInFlight = null;
      }
    }
  }
}
