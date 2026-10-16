import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { FcmService } from './fcm.service';
import { MOCK_CURRENT_USER } from './mock-data';

export interface AppUser extends User {
  is_vip?: boolean;
  vip_tier?: string | null;
  is_serious_learner?: boolean;
  developer_api_key?: string | null;
  display_name?: string;
  avatar_url?: string;
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

  private readonly LOCK_ENABLED_KEY = 'hellotalk_biometric_lock_enabled';
  private readonly CREDENTIAL_ID_KEY = 'hellotalk_biometric_credential_id';

  readonly biometricLockEnabled = signal<boolean>(this.loadBiometricLockPreference());

  /** Latest earned badge status (VIP, serious learner) loaded from Supabase. */
  readonly earnedBadges = signal<{
    isVip: boolean;
    vipTier: string;
    isSeriousLearner: boolean;
  } | null>(null);

  private loadBiometricLockPreference(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(this.LOCK_ENABLED_KEY) === 'true';
  }

  constructor() {
    this.initAuthListener();
  }

  private async initAuthListener(): Promise<void> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.updateAuthState(session);
    if (session) {
      void this.refreshEarnedBadges(session.user.id);
    }
    if (!session) {
      this.currentUser.set(MOCK_CURRENT_USER);
      this.currentSession.set({
        access_token: 'mock-jwt-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: MOCK_CURRENT_USER,
      });
    }
    this.isLoading.set(false);

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.updateAuthState(session);
      if (session) {
        void this.refreshEarnedBadges(session.user.id);
      } else {
        this.earnedBadges.set(null);
      }
      if (!session) {
        this.currentUser.set(MOCK_CURRENT_USER);
        this.currentSession.set({
          access_token: 'mock-jwt-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: MOCK_CURRENT_USER,
        });
      }
    });
  }

  // Starts unlocked: there is no biometric enrollment flow anywhere in the app,
  // so a `navigator.credentials.get()` request always fails (no credential was
  // ever registered for this origin). Defaulting to locked would permanently
  // block every user behind an unlock screen with no way through. Locking only
  // kicks in reactively when the app is backgrounded (see AppComponent's
  // visibilitychange handler), which is the flow `requestBiometric()` can
  // actually satisfy.
  readonly appLocked = signal<boolean>(false);

  private async requestBiometric(): Promise<boolean> {
    if (!this.biometricLockEnabled()) {
      this.appLocked.set(false);
      return true;
    }
    if (!(await this.isBiometricSupported())) {
      // Biometric not supported but lock enabled – cannot unlock.
      return false;
    }
    const storedId = localStorage.getItem(this.CREDENTIAL_ID_KEY);
    if (!storedId) {
      // No credential stored – reset lock preference
      this.biometricLockEnabled.set(false);
      this.appLocked.set(false);
      return true;
    }
    const credentialId = this.base64UrlToArrayBuffer(storedId);
    const credential = await navigator.credentials
      .get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          userVerification: 'required',
          allowCredentials: [{ type: 'public-key', id: credentialId }],
          timeout: 60_000,
        },
        mediation: 'optional',
      })
      .catch(() => null);

    if (credential) {
      this.appLocked.set(false);
      return true;
    }
    // User cancelled or error – keep locked
    return false;
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async createBiometricCredential(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    try {
      const user = this.currentUser();
      if (!user) return false;
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'HelloTalk',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email ?? user.id,
          displayName: user.user_metadata?.['display_name'] ?? user.email ?? user.id,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        excludeCredentials: [],
      };
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });
      if (!credential) return false;
      if (!(credential instanceof PublicKeyCredential)) return false;
      const credentialId = credential.rawId;
      const base64Url = this.arrayBufferToBase64Url(credentialId);
      localStorage.setItem(this.CREDENTIAL_ID_KEY, base64Url);
      return true;
    } catch {
      return false;
    }
  }

  private biometricSupportedCache: boolean | null = null;

  async isBiometricSupported(): Promise<boolean> {
    if (this.biometricSupportedCache !== null) {
      return this.biometricSupportedCache;
    }
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      this.biometricSupportedCache = false;
      return false;
    }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      this.biometricSupportedCache = available;
      return available;
    } catch {
      this.biometricSupportedCache = false;
      return false;
    }
  }

  async lockApp(): Promise<void> {
    if (this.biometricLockEnabled()) {
      this.appLocked.set(true);
    }
  }

  async unlockApp(): Promise<void> {
    await this.requestBiometric();
  }

  private async refreshEarnedBadges(userId: string): Promise<void> {
    try {
      const badges = await this.supabaseService.getEarnedBadges(userId);
      this.earnedBadges.set(badges);
      const user = this.currentUser();
      if (user) {
        this.currentUser.set({
          ...user,
          is_vip: badges.isVip,
          vip_tier: badges.vipTier,
          is_serious_learner: badges.isSeriousLearner,
        });
      }
    } catch (error) {
      console.warn('Failed to load earned badges', error);
      this.earnedBadges.set(null);
    }
  }

  async enableBiometricLock(): Promise<boolean> {
    if (!(await this.isBiometricSupported())) {
      return false;
    }
    const ok = await this.createBiometricCredential();
    if (!ok) return false;
    localStorage.setItem(this.LOCK_ENABLED_KEY, 'true');
    this.biometricLockEnabled.set(true);
    await this.lockApp();
    return true;
  }

  async disableBiometricLock(): Promise<void> {
    localStorage.removeItem(this.LOCK_ENABLED_KEY);
    localStorage.removeItem(this.CREDENTIAL_ID_KEY);
    this.biometricLockEnabled.set(false);
    this.appLocked.set(false);
  }

  private toAppUser(user: User | null): AppUser | null {
    if (!user) return null;
    const appUser: AppUser = { ...user };
    appUser.is_vip = appUser.is_vip ?? false;
    appUser.vip_tier = appUser.vip_tier ?? 'free';
    appUser.is_serious_learner = appUser.is_serious_learner ?? false;
    return appUser;
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
      this.earnedBadges.set(null);
      this.updateAuthState(null);
    }
    return { error };
  }

  private readonly apiUrl = '/api';

  async enableTwoFactor(): Promise<{ secret: string; qrCodeUrl: string }> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ secret: string; qrCodeUrl: string }>(
        `${this.apiUrl}/auth/two-factor/enable`,
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
    try {
      const res = await lastValueFrom(
        this.http.post<{ success: boolean }>(
          `${this.apiUrl}/auth/two-factor/verify`,
          { token },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        ),
      );
      return res.success;
    } catch (error) {
      console.error('2FA verification failed', error);
      return false;
    }
  }

  async disableTwoFactor(): Promise<boolean> {
    const accessToken = this.currentSession()?.access_token;
    const res = await lastValueFrom(
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/auth/two-factor/disable`,
        {},
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
      this.http.get<{ enabled: boolean }>(`${this.apiUrl}/auth/two-factor/status`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );
    return res.enabled;
  }

  getAccessToken(): string | undefined {
    return this.currentSession()?.access_token;
  }

  getBearerHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
    });
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
        error: new AuthError('Invalid two‑factor authentication code. Please try again.'),
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
      this.http.post<{ swapToken: string }>(`${this.apiUrl}/transfer/consume`, {
        token: token,
      }),
    );
  }

  /**
   * Exchange a short‑lived swap JWT for a real Supabase session.
   */
  async swapDeviceLink(swapToken: string): Promise<boolean> {
    try {
      const result = await lastValueFrom(
        this.http.post<{
          access_token: string;
          refresh_token: string;
          user_id: string;
        }>(`${this.apiUrl}/transfer/swap`, { swapToken }),
      );
      const { data: sessionData, error: setError } = await this.supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (setError) {
        return false;
      }
      if (sessionData.session) {
        this.updateAuthState(sessionData.session);
      }
      return true;
    } catch {
      return false;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await lastValueFrom(this.http.post(`${this.apiUrl}/auth/request-password-reset`, { email }));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await lastValueFrom(
      this.http.post(`${this.apiUrl}/auth/reset-password`, {
        token: token,
        newPassword: newPassword,
      }),
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const accessToken = this.getAccessToken();
    await lastValueFrom(
      this.http.post(
        `${this.apiUrl}/auth/change-password`,
        { currentPassword, newPassword },
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${accessToken ?? ''}`,
          }),
        },
      ),
    );
  }

  private http = inject(HttpClient);
}
