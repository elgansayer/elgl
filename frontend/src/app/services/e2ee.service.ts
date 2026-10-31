import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface EncryptedMessagePayload {
  ciphertext: string;
  iv: string;
  is_encrypted: boolean;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isJsonWebKey(value: unknown): value is JsonWebKey {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({
  providedIn: 'root',
})
export class E2eeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private myPrivateKey: CryptoKey | null = null;
  private myPublicKey: CryptoKey | null = null;
  private myUserId: string | null = null;

  // Caches for derived symmetric keys and peer public keys
  private readonly peerPublicKeys = new Map<string, CryptoKey>();
  private readonly sharedKeys = new Map<string, CryptoKey>();
  private readonly roomKeys = new Map<string, CryptoKey>();

  private getHeaders(): { Authorization: string } {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  /**
   * Initialises local cryptographic key pair for the authenticated user and publishes
   * the public key to the backend if needed.
   */
  async initialiseUserKeys(userId: string): Promise<void> {
    if (!userId || typeof window === 'undefined' || !window.crypto?.subtle) {
      return;
    }

    if (this.myUserId === userId && this.myPrivateKey) {
      return;
    }

    this.myUserId = userId;
    const privStorageKey = `e2ee_priv_${userId}`;
    const pubStorageKey = `e2ee_pub_${userId}`;

    const storedPriv = localStorage.getItem(privStorageKey);
    const storedPub = localStorage.getItem(pubStorageKey);

    if (storedPriv && storedPub) {
      try {
        const parsedPriv = JSON.parse(storedPriv);
        const parsedPub = JSON.parse(storedPub);
        if (isJsonWebKey(parsedPriv) && isJsonWebKey(parsedPub)) {
          this.myPrivateKey = await window.crypto.subtle.importKey(
            'jwk',
            parsedPriv,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits'],
          );
          this.myPublicKey = await window.crypto.subtle.importKey(
            'jwk',
            parsedPub,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            [],
          );
          return;
        }
      } catch {
        // Stored key invalid, generate fresh pair below
      }
    }

    // Generate fresh ECDH keypair
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );

    this.myPrivateKey = keyPair.privateKey;
    this.myPublicKey = keyPair.publicKey;

    const exportedPriv = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const exportedPub = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);

    localStorage.setItem(privStorageKey, JSON.stringify(exportedPriv));
    localStorage.setItem(pubStorageKey, JSON.stringify(exportedPub));

    // Register public key on the backend
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/chat/e2ee/keys`,
          { public_key: exportedPub },
          { headers: this.getHeaders() },
        ),
      );
    } catch {
      // Backend registration retryable on subsequent actions
    }
  }

  /**
   * Retrieves and caches the public key for a conversation peer.
   */
  async getPeerPublicKey(peerUserId: string): Promise<CryptoKey | null> {
    if (!peerUserId || typeof window === 'undefined' || !window.crypto?.subtle) {
      return null;
    }

    const cached = this.peerPublicKeys.get(peerUserId);
    if (cached) {
      return cached;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ public_key: Record<string, unknown> }>(
          `${environment.apiUrl}/chat/e2ee/keys/${peerUserId}`,
          { headers: this.getHeaders() },
        ),
      );

      if (response && isJsonWebKey(response.public_key)) {
        const imported = await window.crypto.subtle.importKey(
          'jwk',
          response.public_key,
          { name: 'ECDH', namedCurve: 'P-256' },
          true,
          [],
        );
        this.peerPublicKeys.set(peerUserId, imported);
        return imported;
      }
    } catch {
      // Peer public key not yet available
    }

    return null;
  }

  /**
   * Derives a shared AES-GCM 256-bit symmetric encryption key between the current user
   * and a peer using ECDH.
   */
  async deriveSharedKey(peerUserId: string, currentUserId: string): Promise<CryptoKey | null> {
    if (this.sharedKeys.has(peerUserId)) {
      return this.sharedKeys.get(peerUserId) ?? null;
    }

    await this.initialiseUserKeys(currentUserId);
    if (!this.myPrivateKey) {
      return null;
    }

    const peerPubKey = await this.getPeerPublicKey(peerUserId);
    if (!peerPubKey) {
      return null;
    }

    try {
      const derivedKey = await window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: peerPubKey },
        this.myPrivateKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      this.sharedKeys.set(peerUserId, derivedKey);
      return derivedKey;
    } catch {
      return null;
    }
  }

  /**
   * Derives or retrieves an authenticated room-level fallback key for direct conversations.
   */
  async getOrDeriveRoomKey(roomId: string, _currentUserId: string): Promise<CryptoKey | null> {
    if (this.roomKeys.has(roomId)) {
      return this.roomKeys.get(roomId) ?? null;
    }

    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return null;
    }

    try {
      // Try to fetch existing stored room key from backend
      const response = await firstValueFrom(
        this.http.get<{ encrypted_key: string }>(
          `${environment.apiUrl}/chat/e2ee/rooms/${roomId}/key`,
          { headers: this.getHeaders() },
        ),
      ).catch(() => null);

      let keyBytes: Uint8Array<ArrayBuffer>;
      if (response && typeof response.encrypted_key === 'string' && response.encrypted_key.length > 0) {
        keyBytes = base64ToBytes(response.encrypted_key);
      } else {
        // Generate a new 256-bit room key and store it for this room
        keyBytes = window.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
        const encodedKey = bytesToBase64(keyBytes);
        void firstValueFrom(
          this.http.post(
            `${environment.apiUrl}/chat/e2ee/rooms/${roomId}/key`,
            { encrypted_key: encodedKey },
            { headers: this.getHeaders() },
          ),
        ).catch(() => null);
      }

      const roomKey = await window.crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
      this.roomKeys.set(roomId, roomKey);
      return roomKey;
    } catch {
      return null;
    }
  }

  /**
   * Encrypts plaintext message content with AES-GCM (256-bit) and a unique 12-byte IV.
   */
  async encryptMessage(
    plaintext: string,
    recipientUserId: string,
    roomId?: string,
  ): Promise<EncryptedMessagePayload | null> {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      return null;
    }

    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) {
      return null;
    }

    // Try ECDH shared key first, then fall back to direct room key
    let cipherKey = await this.deriveSharedKey(recipientUserId, currentUser.id);
    if (!cipherKey && roomId) {
      cipherKey = await this.getOrDeriveRoomKey(roomId, currentUser.id);
    }

    if (!cipherKey) {
      return null;
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const encodedText = new TextEncoder().encode(plaintext);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cipherKey,
      encodedText,
    );

    return {
      ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
      iv: bytesToBase64(iv),
      is_encrypted: true,
    };
  }

  /**
   * Decrypts ciphertext message content using the shared key or room key.
   */
  async decryptMessage(
    ciphertextBase64: string,
    ivBase64: string,
    peerUserId?: string,
    roomId?: string,
  ): Promise<string> {
    if (
      !ciphertextBase64 ||
      !ivBase64 ||
      typeof window === 'undefined' ||
      !window.crypto?.subtle
    ) {
      return ciphertextBase64;
    }

    const currentUser = this.authService.currentUser();
    const currentUserId = currentUser?.id ?? '';

    let cipherKey: CryptoKey | null = null;
    if (peerUserId && currentUserId) {
      cipherKey = await this.deriveSharedKey(peerUserId, currentUserId);
    }
    if (!cipherKey && roomId && currentUserId) {
      cipherKey = await this.getOrDeriveRoomKey(roomId, currentUserId);
    }

    if (!cipherKey) {
      return '[Encrypted message]';
    }

    try {
      const ciphertext = base64ToBytes(ciphertextBase64);
      const iv = base64ToBytes(ivBase64);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cipherKey,
        ciphertext,
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      return '[Encrypted message]';
    }
  }
}
