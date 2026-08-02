import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
}
