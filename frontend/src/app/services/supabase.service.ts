import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { openDB, IDBPDatabase } from 'idb';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  native_languages: string[];
  target_languages: string[];
  audio_intro_url: string | null;
  is_vip: boolean;
  vip_tier: string;
  is_serious_learner?: boolean;
  auto_download_preference: string;
  joined_at?: string;
}

/**
 * Supabase access is limited to authentication session management.
 *
 * Every data request goes through the NestJS API (AGENTS.md "API First");
 * direct table queries and storage writes from this service are prohibited.
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private supabaseClient: SupabaseClient | undefined;

  private get supabase(): SupabaseClient {
    if (!this.supabaseClient) {
      this.supabaseClient = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
      );
    }

    return this.supabaseClient;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async getRecentlyJoinedNativeSpeakers(
    limit: number = 10,
  ): Promise<UserProfile[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserProfile[]>(
          `${this.apiUrl}/discovery/recent-native-speakers`,
          { params: { limit } },
        ),
      );
    } catch {
      return [];
    }
  }

  async linkAccount(provider: 'google' | 'apple'): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
    });

    if (error) {
      throw new Error(`Failed to link account: ${error.message}`);
    }
  }

  async unlinkAccount(provider: 'google' | 'apple'): Promise<void> {
    // Identity unlinking is session-bound in Supabase Auth; there is no
    // server-side shadow record.
    const { data, error } = await this.supabase.auth.getUser();
    if (error || !data?.user) {
      throw new Error('Failed to fetch linked accounts');
    }

    const identity = data.user.identities?.find(
      (candidate) => candidate.provider === provider,
    );
    if (!identity) {
      throw new Error(`Provider ${provider} is not linked`);
    }

    const { error: unlinkError } =
      await this.supabase.auth.unlinkIdentity(identity);
    if (unlinkError) {
      throw new Error(`Failed to unlink account: ${unlinkError.message}`);
    }
  }

  async getLinkedAccounts(): Promise<{
    email: boolean;
    google: boolean;
    apple: boolean;
  }> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data?.user) {
      throw new Error('Failed to fetch linked accounts');
    }

    const identities: unknown[] = data.user.identities ?? [];

    const hasProvider = (provider: string): boolean =>
      identities.some((id) => {
        if (id === null || typeof id !== 'object') return false;
        return 'provider' in id && id.provider === provider;
      });

    return {
      email: hasProvider('email'),
      google: hasProvider('google'),
      apple: hasProvider('apple'),
    };
  }

  async getDailyStreak(): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.http.get<{ streak: number }>(`${this.apiUrl}/study-streak/me`),
      );
      return response.streak ?? 0;
    } catch {
      return 0;
    }
  }

  async getEarnedBadges(): Promise<{
    isVip: boolean;
    vipTier: string;
    isSeriousLearner: boolean;
  }> {
    try {
      const profile = await firstValueFrom(
        this.http.get<{
          is_vip?: boolean;
          vip_tier?: string;
          is_serious_learner?: boolean;
        }>(`${this.apiUrl}/users/me`),
      );

      return {
        isVip: profile.is_vip ?? false,
        vipTier: profile.vip_tier ?? 'free',
        isSeriousLearner: profile.is_serious_learner ?? false,
      };
    } catch {
      return {
        isVip: false,
        vipTier: 'free',
        isSeriousLearner: false,
      };
    }
  }

  private async getOfflineDB(): Promise<IDBPDatabase<unknown>> {
    return openDB('OfflineContentDB', 1, {
      upgrade(db: IDBPDatabase<unknown>) {
        if (!db.objectStoreNames.contains('savedContent')) {
          db.createObjectStore('savedContent', { keyPath: 'id' });
        }
      },
    });
  }

  async saveContentOffline(content: { id: string; data: unknown }): Promise<void> {
    const db = await this.getOfflineDB();
    await db.put('savedContent', content);
  }

  async getOfflineContent(id: string): Promise<unknown | null> {
    const db = await this.getOfflineDB();
    return db.get('savedContent', id);
  }

  async getAllOfflineContent(): Promise<unknown[]> {
    const db = await this.getOfflineDB();
    return db.getAll('savedContent');
  }

  async deleteOfflineContent(id: string): Promise<void> {
    const db = await this.getOfflineDB();
    await db.delete('savedContent', id);
  }

  async clearOfflineCache(): Promise<void> {
    const db = await this.getOfflineDB();
    await db.clear('savedContent');
  }

  async deleteOldMedia(thresholdDate: Date): Promise<void> {
    const db = await this.getOfflineDB();
    const allContent = await db.getAll('savedContent');
    for (const content of allContent) {
      if (
        typeof content === 'object' &&
        content !== null &&
        'id' in content &&
        'data' in content &&
        typeof content.id === 'string' &&
        typeof content.data === 'object' &&
        content.data !== null &&
        'timestamp' in content.data &&
        typeof content.data.timestamp === 'string'
      ) {
        const timestamp = new Date(content.data.timestamp);
        if (timestamp < thresholdDate) {
          await db.delete('savedContent', content.id);
        }
      }
    }
  }

  async getAutoDownloadPreference(): Promise<'wifi' | 'cellular'> {
    return Promise.resolve('wifi');
  }
}
