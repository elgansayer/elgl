import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface RoomE2eeKeyResponse {
  e2ee_key: string;
  room_id: string;
  algorithm: string;
}

export interface EncryptedPayloadResult {
  ciphertext: string;
  iv: string;
  payload: string;
}

const E2EE_PAYLOAD_PREFIX = 'e2ee:v1:';
const MAX_E2EE_PAYLOAD_LENGTH = 60000;
const E2EE_PAYLOAD_PATTERN = /^e2ee:v1:[A-Za-z0-9+/]{16}={0,2}:[A-Za-z0-9+/]+={0,2}$/;

function getCryptoSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto SubtleCrypto is not available in this environment.');
}

function getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    return array;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(array);
    return array;
  }
  throw new Error('WebCrypto getRandomValues is not available in this environment.');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Client-side service managing AES-256-GCM content encryption for personal messages.
 *
 * Keys are brokered over authenticated TLS from the NestJS signalling plane,
 * kept strictly in memory for the conversation session, and used with WebCrypto
 * AES-GCM to encrypt message bodies prior to persistence or Centrifugo publication.
 */
@Injectable({
  providedIn: 'root',
})
export class PersonalChatEncryptionService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly keyCache = new Map<string, CryptoKey>();
  private readonly inFlightKeyRequests = new Map<string, Promise<CryptoKey>>();

  /**
   * Retrieves or fetches the AES-256-GCM CryptoKey for the specified direct room.
   */
  async getOrFetchRoomKey(roomId: string): Promise<CryptoKey> {
    if (!roomId) {
      throw new Error('Room identifier is required to resolve E2EE key.');
    }

    const cachedKey = this.keyCache.get(roomId);
    if (cachedKey) {
      return cachedKey;
    }

    const inFlight = this.inFlightKeyRequests.get(roomId);
    if (inFlight) {
      return inFlight;
    }

    const keyPromise = this.fetchAndImportKey(roomId);
    this.inFlightKeyRequests.set(roomId, keyPromise);

    try {
      const cryptoKey = await keyPromise;
      this.keyCache.set(roomId, cryptoKey);
      return cryptoKey;
    } finally {
      this.inFlightKeyRequests.delete(roomId);
    }
  }

  /**
   * Checks whether the current user can access encryption key material for this room.
   */
  async isRoomE2eeCapable(roomId: string): Promise<boolean> {
    try {
      await this.getOrFetchRoomKey(roomId);
      return true;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Encrypts plaintext content for a specific direct room using AES-256-GCM.
   */
  async encryptMessage(roomId: string, plainText: string): Promise<EncryptedPayloadResult> {
    const key = await this.getOrFetchRoomKey(roomId);
    return this.encryptWithKey(key, plainText);
  }

  /** Encrypts for offline queuing only when the room key is already in memory. */
  async encryptCachedMessage(roomId: string, plainText: string): Promise<EncryptedPayloadResult> {
    const key = this.keyCache.get(roomId);
    if (!key) {
      throw new Error('The encrypted room key is unavailable while offline.');
    }
    return this.encryptWithKey(key, plainText);
  }

  private async encryptWithKey(key: CryptoKey, plainText: string): Promise<EncryptedPayloadResult> {
    const subtle = getCryptoSubtle();

    const iv = getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const encoded = new TextEncoder().encode(plainText);

    const ciphertextBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encoded,
    );

    const ciphertext = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));
    const ivBase64 = uint8ArrayToBase64(iv);
    const payload = `${E2EE_PAYLOAD_PREFIX}${ivBase64}:${ciphertext}`;

    return {
      ciphertext,
      iv: ivBase64,
      payload,
    };
  }

  /**
   * Decrypts an encrypted payload for a specific direct room using AES-256-GCM.
   */
  async decryptMessage(roomId: string, envelope: string): Promise<string> {
    if (!envelope || !envelope.startsWith(E2EE_PAYLOAD_PREFIX)) {
      return envelope;
    }
    if (!this.isEncryptedPayload(envelope)) {
      throw new Error('Malformed encryption envelope.');
    }

    const key = await this.getOrFetchRoomKey(roomId);
    const subtle = getCryptoSubtle();

    const content = envelope.slice(E2EE_PAYLOAD_PREFIX.length);
    const separatorIdx = content.indexOf(':');
    if (separatorIdx === -1) {
      throw new Error('Malformed encryption envelope.');
    }

    const ivBase64 = content.slice(0, separatorIdx);
    const ciphertextBase64 = content.slice(separatorIdx + 1);

    const iv = base64ToUint8Array(ivBase64);
    const ciphertext = base64ToUint8Array(ciphertextBase64);

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Returns true if the string is a valid encrypted envelope.
   */
  isEncryptedPayload(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      value.length <= MAX_E2EE_PAYLOAD_LENGTH &&
      E2EE_PAYLOAD_PATTERN.test(value)
    );
  }

  /**
   * Clears key material from in-memory cache (e.g. on user sign-out or chat room navigation).
   */
  clearKey(roomId?: string): void {
    if (roomId) {
      this.keyCache.delete(roomId);
      this.inFlightKeyRequests.delete(roomId);
    } else {
      this.keyCache.clear();
      this.inFlightKeyRequests.clear();
    }
  }

  private async fetchAndImportKey(roomId: string): Promise<CryptoKey> {
    const token = this.authService.getAccessToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await firstValueFrom(
      this.http.get<RoomE2eeKeyResponse>(`${environment.apiUrl}/chat/rooms/${roomId}/e2ee-key`, {
        headers,
      }),
    );

    if (
      !response ||
      !response.e2ee_key ||
      response.room_id !== roomId ||
      response.algorithm !== 'AES-GCM-256'
    ) {
      throw new Error('No E2EE key material returned by the key broker.');
    }

    const rawBytes = base64UrlToUint8Array(response.e2ee_key);
    if (rawBytes.byteLength !== 32) {
      throw new Error('Invalid E2EE key material returned by the key broker.');
    }
    const subtle = getCryptoSubtle();

    return await subtle.importKey(
      'raw',
      rawBytes,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    );
  }
}
