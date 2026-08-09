import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MOCK_LINKED_ACCOUNTS } from '../mock-data';

export interface LinkedAccount {
  provider: string;
  name?: string;
  active: boolean;
  created_at?: string;
}

@Injectable()
export class LinkedAccountsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('provider, name, active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getLinkedAccounts error', error);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        provider: row.provider,
        name: row.name ?? undefined,
        active: row.active ?? false,
        created_at: row.created_at ?? undefined,
      }));
    }

    // Fallback to mock data for seeded users
    const mockAccounts = MOCK_LINKED_ACCOUNTS.filter(
      (a) => a.user_id === userId,
    ).map((row) => ({
      provider: row.provider,
      name: row.name ?? undefined,
      active: row.active,
      created_at: row.created_at,
    }));

    return mockAccounts;
  }

  async linkAccount(
    userId: string,
    provider: string,
    externalName?: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('linked_accounts').upsert(
      {
        user_id: userId,
        provider,
        name: externalName ?? null,
        active: true,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, provider' },
    );

    if (error) {
      console.error('linkAccount error', error);
      throw new Error('Could not link account');
    }
  }

  async unlinkAccount(userId: string, provider: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('linked_accounts')
      .delete()
      .match({ user_id: userId, provider });

    if (error) {
      console.error('unlinkAccount error', error);
      throw new Error('Could not unlink account');
    }
  }
}
