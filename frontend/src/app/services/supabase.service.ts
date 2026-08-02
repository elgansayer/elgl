import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { openDB, IDBPDatabase } from 'idb';
import { environment } from '../../environments/environment';

type Database = {
  public: {
    Tables: {
      user_streaks: {
        Row: { user_id: string; streak_count: number };
        Insert: { user_id: string; streak_count: number };
        Update: { user_id?: string; streak_count?: number };
        Relationships: [];
      };
      users: {
        Row: { id: string; display_name: string; avatar_url: string | null; native_languages: string[]; target_languages: string[]; audio_intro_url: string | null; is_vip: boolean; vip_tier: string; is_serious_learner?: boolean; auto_download_preference: string; joined_at?: string };
        Insert: { id: string; audio_intro_url?: string | null; is_vip?: boolean; vip_tier?: string; is_serious_learner?: boolean; auto_download_preference?: string };
        Update: { id?: string; audio_intro_url?: string | null; is_vip?: boolean; vip_tier?: string; is_serious_learner?: boolean; auto_download_preference?: string };
        Relationships: [];
      };
    };
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
  };
};

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

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    this.supabase = createClient<Database>(environment.supabaseUrl, environment.supabaseAnonKey);
  }


  async getRecentlyJoinedNativeSpeakers(limit: number = 10): Promise<UserProfile[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .order('joined_at', { ascending: false })
      .limit(limit)
      .returns<UserProfile[]>();

    if (error) {
      console.warn('Failed to fetch recently joined native speakers', error);
      return [];
    }

    return data ?? [];
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
    const { error } = await this.supabase.rpc('unlink_provider', { provider });

    if (error) {
      throw new Error(`Failed to unlink account: ${error.message}`);
    }
  }

  async getLinkedAccounts(): Promise<{ email: boolean; google: boolean; apple: boolean }> {
    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data) {
      throw new Error('Failed to fetch linked accounts');
    }

    const identities = data?.user?.identities ?? [];
    return {
      email: identities.some((id) => id.provider === 'email'),
      google: identities.some((id) => id.provider === 'google'),
      apple: identities.some((id) => id.provider === 'apple'),
    };
  }

  async getDailyStreak(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('user_streaks')
      .select('streak_count')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.warn('Failed to fetch daily streak', error);
      return 0;
    }

    return data?.streak_count ?? 0;
  }

  async updateDailyStreak(userId: string, streakCount: number): Promise<void> {
    const { error } = await this.supabase
      .from('user_streaks')
      .upsert({ user_id: userId, streak_count: streakCount });

    if (error) {
      throw new Error(`Failed to update daily streak: ${error.message}`);
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async getUserAudioIntro(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('audio_intro_url')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('Failed to fetch audio_intro_url', error);
      return null;
    }
    return data?.audio_intro_url ?? null;
  }

  async getEarnedBadges(
    userId: string,
  ): Promise<{ isVip: boolean; vipTier: string; isSeriousLearner: boolean }> {
    const { data, error } = await this.supabase
      .from('users')
      .select('is_vip, vip_tier, is_serious_learner')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Failed to fetch earned badges', error);
      return {
        isVip: false,
        vipTier: 'free',
        isSeriousLearner: false,
      };
    }

    return {
      isVip: data?.is_vip ?? false,
      vipTier: data?.vip_tier ?? 'free',
      isSeriousLearner: data?.is_serious_learner ?? false,
    };
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
      if (content?.data?.timestamp && new Date(content.data.timestamp) < thresholdDate) {
        await db.delete('savedContent', content.id);
      }
    }
  }

  async uploadFile(file: File, folder: string): Promise<{ fileUrl: string | null }> {
    const fileName = `${folder}/${Date.now()}-${file.name}`;
    const uploadResponse = await this.supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadResponse.error) {
      throw new Error(`Failed to upload file: ${uploadResponse.error.message}`);
    }

    const { data: publicUrlData } = this.supabase.storage.from('documents').getPublicUrl(fileName);
    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to retrieve public URL for file');
    }
    return { fileUrl: publicUrlData.publicUrl };
  }


  async listFiles(folder: string): Promise<string[]> {
    const { data, error } = await this.supabase.storage.from('documents').list(folder);

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data?.map((file) => file.name) ?? [];
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage.from('documents').remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getAutoDownloadPreference(): Promise<'wifi' | 'cellular'> {
    return 'wifi';
  }
}
