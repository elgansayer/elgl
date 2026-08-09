import { Injectable, signal, inject } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AppLockService {
  private readonly lockEnabledKey = 'hellotalk-biometric-lock';
  private readonly credentialIdKey = 'hellotalk-biometric-credential-id';

  private readonly authService = inject(AuthService);

  private readonly appLockedSignal = signal<boolean>(false);
  private readonly biometricEnabledSignal = signal<boolean>(false);
  private readonly biometricAvailableSignal = signal<boolean>(false);

  readonly appLocked = this.appLockedSignal.asReadonly();
  readonly biometricEnabled = this.biometricEnabledSignal.asReadonly();
  readonly biometricAvailable = this.biometricAvailableSignal.asReadonly();

  constructor() {
    const stored =
      typeof localStorage !== 'undefined' ? localStorage.getItem(this.lockEnabledKey) : null;
    const storedCredentialId =
      typeof localStorage !== 'undefined' ? localStorage.getItem(this.credentialIdKey) : null;
    if (stored === 'true' && storedCredentialId) {
      this.biometricEnabledSignal.set(true);
      this.appLockedSignal.set(true);
    }
    this.determineBiometricAvailability();
  }

  private async determineBiometricAvailability(): Promise<void> {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      this.biometricAvailableSignal.set(false);
      return;
    }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      this.biometricAvailableSignal.set(available);
    } catch {
      this.biometricAvailableSignal.set(false);
    }
  }

  async isBiometricSupported(): Promise<boolean> {
    return this.biometricAvailableSignal();
  }

  async enableBiometricLock(): Promise<boolean> {
    if (!(await this.isBiometricSupported())) {
      return false;
    }
    const user = this.authService.currentUser();
    if (!user) {
      return false;
    }
    const credentialId = await this.registerCredential(user);
    if (!credentialId) {
      return false;
    }
    localStorage.setItem(this.lockEnabledKey, 'true');
    localStorage.setItem(this.credentialIdKey, credentialId);
    this.biometricEnabledSignal.set(true);
    this.appLockedSignal.set(true);
    return true;
  }

  async disableBiometricLock(): Promise<boolean> {
    localStorage.removeItem(this.lockEnabledKey);
    localStorage.removeItem(this.credentialIdKey);
    this.biometricEnabledSignal.set(false);
    this.appLockedSignal.set(false);
    return true;
  }

  async unlock(): Promise<boolean> {
    if (!this.biometricEnabledSignal()) {
      this.appLockedSignal.set(false);
      return true;
    }
    const storedCredentialId = localStorage.getItem(this.credentialIdKey);
    if (!storedCredentialId) {
      localStorage.removeItem(this.lockEnabledKey);
      this.biometricEnabledSignal.set(false);
      this.appLockedSignal.set(false);
      return true;
    }
    const ok = await this.authenticateCredential(storedCredentialId);
    if (ok) {
      this.appLockedSignal.set(false);
      return true;
    }
    return false;
  }

  lockNow(): void {
    if (this.biometricEnabledSignal()) {
      this.appLockedSignal.set(true);
    }
  }

  private async registerCredential(user: User): Promise<string | null> {
    try {
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const metadataDisplayName = user.user_metadata?.['display_name'];
      const displayName =
        typeof metadataDisplayName === 'string' && metadataDisplayName.length > 0
          ? metadataDisplayName
          : user.email ?? user.id;
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: 'HelloTalk Clone' },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email ?? user.id,
          displayName,
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
      const credential = await navigator.credentials.create({ publicKey });
      if (!credential) {
        return null;
      }
      if (!(credential instanceof PublicKeyCredential)) {
        return null;
      }
      return this.arrayBufferToBase64Url(credential.rawId);
    } catch {
      return null;
    }
  }

  private async authenticateCredential(storedCredentialId: string): Promise<boolean> {
    try {
      const allowCredentialId = this.base64UrlToArrayBuffer(storedCredentialId);
      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const request: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: allowCredentialId }],
        timeout: 60000,
        userVerification: 'required',
      };
      const assertion = await navigator.credentials.get({ publicKey: request });
      return assertion !== null;
    } catch {
      return false;
    }
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
}
