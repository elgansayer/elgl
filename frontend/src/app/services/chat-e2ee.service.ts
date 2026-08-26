import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const DB_NAME = 'elgl-chat-e2ee';
const STORE_NAME = 'identities';
const DB_VERSION = 1;
const MAX_DECRYPTED_PAYLOAD_BYTES = 3_500_000;
const MAX_DEVICES = 20;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface PublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

interface DeviceIdentity {
  userId: string;
  deviceId: string;
  privateKey: CryptoKey;
  publicKey: PublicJwk;
}

interface RoomDevice {
  user_id: string;
  device_id: string;
  public_key: PublicJwk;
}

interface RoomState {
  direct: boolean;
  required: boolean;
  participants: string[];
  devices: RoomDevice[];
}

interface EncryptedEnvelope {
  device_id: string;
  ephemeral_public_key: PublicJwk;
  iv: string;
  wrapped_key: string;
}

interface EncryptedWireMessage {
  room_id: string;
  encryption_version: 1;
  ciphertext: string;
  iv: string;
  envelopes: EncryptedEnvelope[];
}

interface StoredEncryptedMessage {
  room_id?: unknown;
  message_type?: unknown;
  encryption_version?: unknown;
  encrypted_payload?: unknown;
  encryption_iv?: unknown;
  encryption_envelopes?: unknown;
  [key: string]: unknown;
}

export interface PreparedChatRequest {
  encrypted: boolean;
  body: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPublicJwk(value: unknown): value is PublicJwk {
  if (!isRecord(value)) return false;
  return (
    value['kty'] === 'EC' &&
    value['crv'] === 'P-256' &&
    typeof value['x'] === 'string' &&
    typeof value['y'] === 'string' &&
    /^[A-Za-z0-9_-]{40,50}$/.test(value['x']) &&
    /^[A-Za-z0-9_-]{40,50}$/.test(value['y']) &&
    !('d' in value)
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encrypted payload.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

@Injectable({ providedIn: 'root' })
export class ChatE2eeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/chat/e2ee`;
  private identityPromise: Promise<DeviceIdentity> | null = null;

  isEncryptedStoredMessage(value: unknown): value is StoredEncryptedMessage {
    return (
      isRecord(value) &&
      value['message_type'] === 'encrypted' &&
      value['encryption_version'] === 1 &&
      typeof value['encrypted_payload'] === 'string' &&
      typeof value['encryption_iv'] === 'string' &&
      Array.isArray(value['encryption_envelopes'])
    );
  }

  async prepareOutgoing(body: unknown): Promise<PreparedChatRequest> {
    if (!isRecord(body) || typeof body['room_id'] !== 'string') {
      return { encrypted: false, body: isRecord(body) ? body : {} };
    }
    if (!this.browserCryptoAvailable()) {
      const state = await this.getRoomState(body['room_id']);
      if (state.direct && state.required) {
        throw new Error('End-to-end encryption is required but unavailable on this device.');
      }
      return { encrypted: false, body };
    }

    const identity = await this.ensureRegisteredIdentity();
    const state = await this.getRoomState(body['room_id']);
    if (!state.direct || !state.required) {
      return { encrypted: false, body };
    }
    if (state.devices.length < 2 || state.devices.length > MAX_DEVICES) {
      throw new Error('Encrypted chat device list is invalid.');
    }

    const logicalPayload = { ...body };
    delete logicalPayload['room_id'];
    const plaintext = encoder.encode(JSON.stringify(logicalPayload));
    if (plaintext.byteLength > MAX_DECRYPTED_PAYLOAD_BYTES) {
      throw new Error('Message is too large to encrypt.');
    }

    const messageKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const rawMessageKey = new Uint8Array(await crypto.subtle.exportKey('raw', messageKey));
    const messageIv = randomIv();
    const aad = encoder.encode(`elgl-chat:${body['room_id']}:v1`);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: messageIv, additionalData: aad }, messageKey, plaintext),
    );

    const ephemeralPair = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    const ephemeralPublic = this.normalisePublicJwk(
      await crypto.subtle.exportKey('jwk', ephemeralPair.publicKey),
    );

    const envelopes: EncryptedEnvelope[] = [];
    for (const device of state.devices) {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        device.public_key,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: publicKey },
        ephemeralPair.privateKey,
        256,
      );
      const wrappingKey = await this.deriveWrappingKey(
        sharedBits,
        body['room_id'],
        device.device_id,
        ['encrypt'],
      );
      const wrapIv = randomIv();
      const wrappedKey = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: wrapIv, additionalData: encoder.encode(device.device_id) },
          wrappingKey,
          rawMessageKey,
        ),
      );
      envelopes.push({
        device_id: device.device_id,
        ephemeral_public_key: ephemeralPublic,
        iv: bytesToBase64Url(wrapIv),
        wrapped_key: bytesToBase64Url(wrappedKey),
      });
    }

    const wire: EncryptedWireMessage = {
      room_id: body['room_id'],
      encryption_version: 1,
      ciphertext: bytesToBase64Url(ciphertext),
      iv: bytesToBase64Url(messageIv),
      envelopes,
    };

    // Keep the current identity referenced so a storage reset between key discovery
    // and the request cannot accidentally make the local sender unable to decrypt.
    if (!envelopes.some((envelope) => envelope.device_id === identity.deviceId)) {
      throw new Error('Current encryption device is not an active room recipient.');
    }
    return { encrypted: true, body: wire as unknown as Record<string, unknown> };
  }

  async decryptMessage<T>(message: T): Promise<T> {
    if (!this.isEncryptedStoredMessage(message)) return message;
    if (!this.browserCryptoAvailable()) return this.unavailableMessage(message) as T;

    try {
      const identity = await this.ensureRegisteredIdentity();
      const envelopes = message.encryption_envelopes as unknown[];
      const envelope = envelopes.find(
        (candidate) => isRecord(candidate) && candidate['device_id'] === identity.deviceId,
      );
      if (!isRecord(envelope) || !isPublicJwk(envelope['ephemeral_public_key'])) {
        return this.unavailableMessage(message) as T;
      }
      if (typeof envelope['iv'] !== 'string' || typeof envelope['wrapped_key'] !== 'string') {
        return this.unavailableMessage(message) as T;
      }

      const ephemeralPublic = await crypto.subtle.importKey(
        'jwk',
        envelope['ephemeral_public_key'],
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPublic },
        identity.privateKey,
        256,
      );
      const wrappingKey = await this.deriveWrappingKey(
        sharedBits,
        String(message.room_id),
        identity.deviceId,
        ['decrypt'],
      );
      const rawMessageKey = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: base64UrlToBytes(envelope['iv']),
          additionalData: encoder.encode(identity.deviceId),
        },
        wrappingKey,
        base64UrlToBytes(envelope['wrapped_key']),
      );
      const messageKey = await crypto.subtle.importKey(
        'raw',
        rawMessageKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );
      const clearBytes = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: base64UrlToBytes(String(message.encryption_iv)),
            additionalData: encoder.encode(`elgl-chat:${String(message.room_id)}:v1`),
          },
          messageKey,
          base64UrlToBytes(String(message.encrypted_payload)),
        ),
      );
      if (clearBytes.byteLength > MAX_DECRYPTED_PAYLOAD_BYTES) {
        throw new Error('Decrypted message exceeds the client safety limit.');
      }
      const payload = JSON.parse(decoder.decode(clearBytes)) as unknown;
      if (!isRecord(payload) || typeof payload['message_type'] !== 'string') {
        throw new Error('Invalid encrypted message contents.');
      }

      return {
        ...message,
        ...payload,
        is_end_to_end_encrypted: true,
        encrypted_payload: undefined,
        encryption_iv: undefined,
        encryption_envelopes: undefined,
      } as T;
    } catch {
      return this.unavailableMessage(message) as T;
    }
  }

  async decryptPublication(payload: unknown): Promise<unknown> {
    if (!isRecord(payload) || !this.isEncryptedStoredMessage(payload['message'])) return payload;
    return { ...payload, message: await this.decryptMessage(payload['message']) };
  }

  private unavailableMessage(message: StoredEncryptedMessage): Record<string, unknown> {
    return {
      ...message,
      message_type: 'text',
      text_content: '🔒 Encrypted message unavailable on this device.',
      media_url: undefined,
      correction_payload: undefined,
      is_end_to_end_encrypted: true,
      encryption_unavailable: true,
      encrypted_payload: undefined,
      encryption_iv: undefined,
      encryption_envelopes: undefined,
    };
  }

  private async ensureRegisteredIdentity(): Promise<DeviceIdentity> {
    const userId = this.authService.currentUser()?.id;
    const token = this.authService.getAccessToken();
    if (!userId || !token) throw new Error('Authentication is required for encrypted chat.');

    if (!this.identityPromise) {
      this.identityPromise = this.loadOrCreateIdentity(userId).catch((error) => {
        this.identityPromise = null;
        throw error;
      });
    }
    const identity = await this.identityPromise;
    if (identity.userId !== userId) {
      this.identityPromise = null;
      return this.ensureRegisteredIdentity();
    }

    await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/devices`,
        { device_id: identity.deviceId, public_key: identity.publicKey },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    return identity;
  }

  private async getRoomState(roomId: string): Promise<RoomState> {
    const token = this.authService.getAccessToken();
    if (!token) throw new Error('Authentication is required for encrypted chat.');
    const state = await firstValueFrom(
      this.http.get<RoomState>(`${this.baseUrl}/rooms/${encodeURIComponent(roomId)}/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (
      !state ||
      typeof state.direct !== 'boolean' ||
      typeof state.required !== 'boolean' ||
      !Array.isArray(state.participants) ||
      !Array.isArray(state.devices) ||
      state.devices.length > MAX_DEVICES ||
      state.devices.some(
        (device) =>
          !device ||
          typeof device.user_id !== 'string' ||
          typeof device.device_id !== 'string' ||
          !isPublicJwk(device.public_key),
      )
    ) {
      throw new Error('Invalid encrypted-chat capability response.');
    }
    return state;
  }

  private browserCryptoAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined'
    );
  }

  private async loadOrCreateIdentity(userId: string): Promise<DeviceIdentity> {
    const db = await this.openDb();
    const existing = await new Promise<DeviceIdentity | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(userId);
      request.onsuccess = () => resolve(request.result as DeviceIdentity | undefined);
      request.onerror = () => reject(new Error('Encrypted chat storage read failed.'));
    });
    if (
      existing &&
      existing.userId === userId &&
      typeof existing.deviceId === 'string' &&
      existing.privateKey instanceof CryptoKey &&
      isPublicJwk(existing.publicKey)
    ) {
      db.close();
      return existing;
    }

    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    const publicKey = this.normalisePublicJwk(await crypto.subtle.exportKey('jwk', pair.publicKey));
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      privateJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
    const identity: DeviceIdentity = {
      userId,
      deviceId: crypto.randomUUID(),
      privateKey,
      publicKey,
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(identity);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Encrypted chat storage write failed.'));
      transaction.onabort = () => reject(new Error('Encrypted chat storage write was aborted.'));
    });
    db.close();
    return identity;
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Encrypted chat storage is unavailable.'));
      request.onblocked = () => reject(new Error('Encrypted chat storage upgrade is blocked.'));
    });
  }

  private normalisePublicJwk(jwk: JsonWebKey): PublicJwk {
    if (!isPublicJwk(jwk)) throw new Error('Browser returned an invalid P-256 public key.');
    return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
  }

  private async deriveWrappingKey(
    sharedBits: ArrayBuffer,
    roomId: string,
    deviceId: string,
    usages: KeyUsage[],
  ): Promise<CryptoKey> {
    const hkdfBase = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const salt = await crypto.subtle.digest('SHA-256', encoder.encode(roomId));
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info: encoder.encode(`elgl-chat-wrap:v1:${deviceId}`),
      },
      hkdfBase,
      { name: 'AES-GCM', length: 256 },
      false,
      usages,
    );
  }
}
