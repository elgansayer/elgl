import { Injectable, signal, computed, inject } from '@angular/core';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

export interface AppUser extends User {
  is_vip?: boolean;
  vip_tier?: string | null;
  developer_api_key?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();

  // Reactive Angular Signals for Auth State
  readonly currentUser = signal<AppUser | null>(null);
  readonly currentSession = signal<Session | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isLoading = signal<boolean>(true);

  constructor() {
    this.initAuthListener();
  }

  private async initAuthListener(): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    this.updateAuthState(session);
    this.isLoading.set(false);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.updateAuthState(session);
    });
  }

  private updateAuthState(session: Session | null): void {
    this.currentSession.set(session);
    this.currentUser.set((session?.user as AppUser) ?? null);
  }

  async signInWithEmail(email: string, password: string): Promise<{ user: AppUser | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (data.session) {
      this.updateAuthState(data.session);
    }
    return { user: (data.user as AppUser) || null, error };
  }

  async signUpWithEmail(email: string, password: string): Promise<{ user: AppUser | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (data.session) {
      this.updateAuthState(data.session);
    }
    return { user: (data.user as AppUser) || null, error };
  }

  async signInWithGoogle(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { error };
  }

  async signInWithApple(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      this.updateAuthState(null);
    }
    return { error };
  }

  getAccessToken(): string | undefined {
    return this.currentSession()?.access_token;
  }
}
