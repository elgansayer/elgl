import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface AdminRuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AdminLoginService {
  private client: SupabaseClient | null = null;
  private config: AdminRuntimeConfig | null = null;
  private readonly accessTokenState = signal<string | null>(null);

  readonly accessToken = this.accessTokenState.asReadonly();

  async signIn(email: string, password: string): Promise<void> {
    const client = await this.getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session?.access_token) {
      throw new Error(error?.message ?? 'Authentication failed');
    }

    this.accessTokenState.set(data.session.access_token);
    await client.auth.signOut({ scope: 'local' });
  }

  async apiBaseUrl(): Promise<string> {
    await this.getClient();
    return this.config?.apiBaseUrl ?? '/api';
  }

  signOut(): void {
    this.accessTokenState.set(null);
  }

  private async getClient(): Promise<SupabaseClient> {
    if (this.client) {
      return this.client;
    }

    const response = await fetch('/admin-config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Admin runtime configuration is unavailable');
    }

    this.config = (await response.json()) as AdminRuntimeConfig;
    this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return this.client;
  }
}
