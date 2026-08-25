import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { UserIdentity } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

export type LinkedAccountProvider = 'email' | 'google' | 'apple';

export interface LinkedAccount {
  provider: LinkedAccountProvider;
  name?: string;
  active: true;
  created_at?: string;
  identity_id?: string;
}

const VISIBLE_PROVIDERS = new Set<LinkedAccountProvider>([
  'email',
  'google',
  'apple',
]);

@Injectable()
export class LinkedAccountsService {
  private readonly logger = new Logger(LinkedAccountsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      this.logger.warn('linked_accounts_identity_lookup_failed');
      throw new ServiceUnavailableException(
        'Linked accounts are temporarily unavailable',
      );
    }

    return (data.user.identities ?? [])
      .filter(
        (
          identity,
        ): identity is UserIdentity & { provider: LinkedAccountProvider } =>
          VISIBLE_PROVIDERS.has(
            identity.provider as LinkedAccountProvider,
          ),
      )
      .map((identity) => ({
        provider: identity.provider,
        active: true as const,
        identity_id: identity.identity_id,
        created_at: identity.created_at,
        name: this.identityDisplayName(identity),
      }));
  }

  private identityDisplayName(identity: UserIdentity): string | undefined {
    const data = identity.identity_data;
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    for (const key of ['email', 'full_name', 'name'] as const) {
      const value: unknown = data[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed.slice(0, 200);
        }
      }
    }
    return undefined;
  }
}
