import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { openDB, IDBPDatabase } from 'idb';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
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

  private async getOfflineDB(): Promise<IDBPDatabase> {
    return openDB('OfflineContentDB', 1, {
      upgrade(db: IDBPDatabase) {
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
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const fileName = `avatars/${Date.now()}-${file.name}`;
    const { error } = await this.supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }

    const { data } = this.supabase.storage.from('avatars').getPublicUrl(fileName);
    return { avatarUrl: data.publicUrl };
  }
}
