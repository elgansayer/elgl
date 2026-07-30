import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { FcmService } from './fcm.service';

export interface AppUser extends User {
  is_vip?: boolean;
  vip_tier?: string | null;
  developer_api_key?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private fcmService = inject(FcmService);
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
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.updateAuthState(session);
    if (!session) {
      import('./mock-data').then((m) => {
        this.currentUser.set(m.MOCK_CURRENT_USER);
      });
    }
    this.isLoading.set(false);

    // Initial biometric unlock
    await this.unlockApp();

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.updateAuthState(session);
      if (!session) {
        import('./mock-data').then((m) => {
          this.currentUser.set(m.MOCK_CURRENT_USER);
        });
      }
    });
  }

  readonly appLocked = signal<boolean>(true);

  private async requestBiometric(): Promise<boolean> {
    if (!(await this.isBiometricSupported())) {
      // Biometric not supported – unlock automatically
      this.appLocked.set(false);
      return true;
    }
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: window.location.hostname,
        userVerification: 'required',
        allowCredentials: [],
        timeout: 60_000,
      },
      mediation: 'optional',
    }).catch(() => null);

    if (credential) {
      this.appLocked.set(false);
      return true;
    }
    // User cancelled or error – keep locked
    return false;
  }

  private async isBiometricSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }

  async lockApp(): Promise<void> {
    this.appLocked.set(true);
  }

  async unlockApp(): Promise<void> {
    await this.requestBiometric();
  }

  private toAppUser(user: User | null): AppUser | null {
    if (!user) return null;
    return { ...user };
  }

  private updateAuthState(session: Session | null): void {
    this.currentSession.set(session);
    if (session) {
      this.currentUser.set(this.toAppUser(session.user)!);
    }
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: AppUser | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (data.session) {
      this.updateAuthState(data.session);
    }
    return { user: this.toAppUser(data.user), error };
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: AppUser | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (data.session) {
      this.updateAuthState(data.session);
    }
    return { user: this.toAppUser(data.user), error };
  }

  async signInWithGoogle(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  }

  async signInWithApple(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    // Unregister FCM token before logging out
    await this.fcmService.unregisterToken();

    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      this.updateAuthState(null);
    }
    return { error };
  }

  private readonly apiUrl = '/api';

  async enableTwoFactor(): Promise<{ secret: string; qrCodeUrl: string }> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ secret: string; qrCodeUrl: string }>(
        `${this.apiUrl}/two-factor/enable`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );
    return res;
  }

  async verifyTwoFactor(token: string): Promise<boolean> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/two-factor/verify`,
        { token },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );
    return res.success;
  }

  async disableTwoFactor(token: string): Promise<boolean> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/two-factor/disable`,
        { token },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );
    return res.success;
  }

  async checkTwoFactorStatus(): Promise<boolean> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.get<{ enabled: boolean }>(
        `${this.apiUrl}/two-factor/status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );
    return res.enabled;
  }

  getAccessToken(): string | undefined {
    return this.currentSession()?.access_token;
  }

  /**
   * Check if the current user has two‑factor authentication enabled.
   */
  async isTwoFactorEnabled(): Promise<boolean> {
    try {
      return await this.checkTwoFactorStatus();
    } catch {
      // If the API call fails (e.g. network), treat as disabled.
      return false;
    }
  }

  /**
   * Perform the second stage of sign‑in: after the password is validated,
   * this method verifies a 2FA token and returns the authenticated user.
   */
  async signInWithTwoFactor(
    email: string,
    password: string,
    twoFactorToken: string,
  ): Promise<{ user: AppUser | null; error: AuthError | null }> {
    // 1. Sign in with password (Supabase will return the user session
    //    even if 2FA is enabled on the backend; we rely on the 2FA
    //    verification below for extra protection).
    const { data: passwordData, error: passwordError } =
      await this.supabase.auth.signInWithPassword({ email, password });

    if (passwordError) {
      return { user: null, error: passwordError };
    }

    // 2. Verify the supplied 2FA token via the dedicated endpoint.
    const tokenValid = await this.verifyTwoFactor(twoFactorToken);
    if (!tokenValid) {
      // Sign the user out so the session doesn't remain active.
      await this.supabase.auth.signOut();
      return {
        user: null,
        error: new AuthError(
          'Invalid two‑factor authentication code. Please try again.',
        ),
      };
    }

    // 3. Refresh session (optional – Supabase session already contains the user).
    this.updateAuthState(passwordData.session);

    return { user: this.toAppUser(passwordData.user), error: null };
  }

  /**
   * Generate a one‑time magic link that the user can open on another device
   * to be automatically signed in without keeping the current device online.
   */
  async generateDeviceLink(): Promise<string> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ url: string }>(
        `${this.apiUrl}/transfer/generate`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );
    return res.url;
  }

  /**
   * Consume a device‑transfer token (called on the receiving device).
   * Returns a short‑lived swap JWT that can be exchanged for a real session.
   */
  async consumeDeviceLink(token: string): Promise<{ swapToken: string }> {
    return await lastValueFrom(
      this.http.post<{ swapToken: string }>(
        `${this.apiUrl}/transfer/consume`,
        { token },
      ),
    );
  }

  private http = inject(HttpClient);
}
