import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

const DB_NAME = 'elgl-chat-e2ee-v1';
const DB_VERSION = 1;
const IDENTITY_STORE = 'identities';
const ALGORITHM = 'ECDH-P256-HKDF-SHA256-AES256-GCM' as const;
const MAX_CIPHERTEXT_LENGTH = 4_500_000;
const MAX_PLAINTEXT_BYTES = 3_300_000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface E2eePublicKeyJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

export interface E2eeRoomDevice {
  user_id: string;
  device_id: string;
  public_key_jwk: E2eePublicKeyJwk;
}

export interface E2eeRoomDirectory {
  personal: boolean;
  devices: E2eeRoomDevice[];
}

export interface E2eeDeviceRegistration {
  device_id: string;
  public_key_jwk: E2eePublicKeyJwk;
}

interface StoredIdentity {
  userId: string;
  deviceId: string;
  privateKey: CryptoKey;
  publicKeyJwk: E2eePublicKeyJwk;
}

interface E2eeKeyEnvelope {
  device_id: string;
  nonce: string;
  wrapped_key: string;
}

export interface EncryptedChatPayload {
  version: 1;
  algorithm: typeof ALGORITHM;
  sender_device_id: string;
  sender_public_key: E2eePublicKeyJwk;
  nonce: string;
  ciphertext: string;
  envelopes: E2eeKeyEnvelope[];
}

interface EncryptableMessage {
  room_id: string;
  message_type: string;
  text_content?: unknown;
  media_url?: unknown;
  correction_payload?: unknown;
  correction_request_payload?: unknown;
  status_reply_payload?: unknown;
  reply_to_id?: unknown;
}

const ALLOWED_MESSAGE_TYPES = new Set([
  'text',
  'voice',
  'correction',
  'doodle',
  'sticker',
  'correction_request',
  'status_reply',
  'view_once_media',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isPublicJwk(value: unknown): value is E2eePublicKeyJwk {
  if (!isRecord(value)) return false;
  return (
    value['kty'] === 'EC' &&
    value['crv'] === 'P-256' &&
    typeof value['x'] === 'string' &&
    typeof value['y'] === 'string' &&
    value['x'].length > 0 &&
    value['x'].length <= 128 &&
    value['y'].length > 0 &&
    value['y'].length <= 128 &&
    BASE64URL_PATTERN.test(value['x']) &&
    BASE64URL_PATTERN.test(value['y']) &&
    !('d' in value)
  );
}

function isRoomDirectory(value: unknown): value is E2eeRoomDirectory {
  if (!isRecord(value) || typeof value['personal'] !== 'boolean' || !Array.isArray(value['devices'])) {
    return false;
  }
  if (value['devices'].length > 20) return false;
  return value['devices'].every(
    (device) =>
      isRecord(device) &&
      typeof device['user_id'] === 'string' &&
      typeof device['device_id'] === 'string' &&
      isUuid(device['device_id']) &&
      isPublicJwk(device['public_key_jwk']),
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string, maxLength = MAX_CIPHERTEXT_LENGTH): Uint8Array {
  if (!value || value.length > maxLength || !BASE64URL_PATTERN.test(value)) {
    throw new Error('Invalid encrypted payload encoding');
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

function randomBytes(length: number): Uint8Array {
  const value = new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}

@Injectable({ providedIn: 'root' })
export class ChatE2eeService {
  private readonly auth = inject(AuthService);
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private readonly identityPromises = new Map<string, Promise<StoredIdentity>>();

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof indexedDB !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      !!crypto.subtle
    );
  }

  parseDirectory(value: unknown): E2eeRoomDirectory {
    if (!isRoomDirectory(value)) {
      throw new Error('Invalid encryption device directory');
    }
    return value;
  }

  async getRegistration(): Promise<E2eeDeviceRegistration> {
    const identity = await this.getIdentity();
    return {
      device_id: identity.deviceId,
      public_key_jwk: identity.publicKeyJwk,
    };
  }

  async encryptOutgoingMessage(
    body: EncryptableMessage,
    rawDirectory: unknown,
  ): Promise<{
    room_id: string;
    message_type: string;
    reply_to_id?: string;
    encrypted_payload: EncryptedChatPayload;
  }> {
    const directory = this.parseDirectory(rawDirectory);
    if (!directory.personal) {
      throw new Error('Only personal chats use end-to-end encryption');
    }
    if (!isUuid(body.room_id) || !ALLOWED_MESSAGE_TYPES.has(body.message_type)) {
      throw new Error('Message cannot be encrypted');
    }

    const currentUserId = this.auth.currentUser()?.id;
    if (!currentUserId) throw new Error('Encryption requires authentication');

    const identity = await this.getIdentity();
    const ownerIds = new Set(directory.devices.map((device) => device.user_id));
    if (!ownerIds.has(currentUserId) || ownerIds.size !== 2) {
      throw new Error('Both participants must enroll an encryption device');
    }
    if (!directory.devices.some((device) => device.device_id === identity.deviceId)) {
      throw new Error('Current encryption device is not registered');
    }

    const plaintextObject = {
      ...(body.text_content !== undefined ? { text_content: body.text_content } : {}),
      ...(body.media_url !== undefined ? { media_url: body.media_url } : {}),
      ...(body.correction_payload !== undefined
        ? { correction_payload: body.correction_payload }
        : {}),
      ...(body.correction_request_payload !== undefined
        ? { correction_request_payload: body.correction_request_payload }
        : {}),
      ...(body.status_reply_payload !== undefined
        ? { status_reply_payload: body.status_reply_payload }
        : {}),
    };
    const plaintext = this.encoder.encode(JSON.stringify(plaintextObject));
    if (plaintext.byteLength === 0 || plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
      throw new Error('Encrypted message is too large');
    }

    const contentKeyBytes = randomBytes(32);
    const contentKey = await crypto.subtle.importKey(
      'raw',
      contentKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );
    const nonce = randomBytes(12);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
          additionalData: this.contentAad(body.room_id, body.message_type, identity.deviceId),
        },
        contentKey,
        plaintext,
      ),
    );

    const envelopes: E2eeKeyEnvelope[] = [];
    const seenDevices = new Set<string>();
    for (const device of directory.devices) {
      if (seenDevices.has(device.device_id)) continue;
      seenDevices.add(device.device_id);
      const wrappingKey = await this.deriveWrappingKey(
        identity.privateKey,
        device.public_key_jwk,
        body.room_id,
        identity.deviceId,
        device.device_id,
      );
      const wrappingNonce = randomBytes(12);
      const wrapped = new Uint8Array(
        await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: wrappingNonce,
            additionalData: this.envelopeAad(
              body.room_id,
              identity.deviceId,
              device.device_id,
            ),
          },
          wrappingKey,
          contentKeyBytes,
        ),
      );
      envelopes.push({
        device_id: device.device_id,
        nonce: encodeBase64Url(wrappingNonce),
        wrapped_key: encodeBase64Url(wrapped),
      });
    }
    contentKeyBytes.fill(0);

    if (envelopes.length < 2 || envelopes.length > 20) {
      throw new Error('Encryption device coverage is incomplete');
    }

    return {
      room_id: body.room_id,
      message_type: body.message_type,
      ...(typeof body.reply_to_id === 'string' ? { reply_to_id: body.reply_to_id } : {}),
      encrypted_payload: {
        version: 1,
        algorithm: ALGORITHM,
        sender_device_id: identity.deviceId,
        sender_public_key: identity.publicKeyJwk,
        nonce: encodeBase64Url(nonce),
        ciphertext: encodeBase64Url(ciphertext),
        envelopes,
      },
    };
  }

  async decryptMessage(message: unknown): Promise<unknown> {
    if (!isRecord(message) || !isRecord(message['encrypted_payload'])) return message;
    const encrypted = message['encrypted_payload'];
    try {
      const decrypted = await this.decryptPayload(message, encrypted);
      return {
        ...message,
        text_content: undefined,
        media_url: undefined,
        correction_payload: undefined,
        correction_request_payload: undefined,
        status_reply_payload: undefined,
        ...decrypted,
        encrypted_payload: undefined,
        is_end_to_end_encrypted: true,
      };
    } catch {
      // Fail closed: never expose ciphertext or a partially decrypted payload.
      // A new device may legitimately lack an envelope for historical messages.
      return {
        ...message,
        message_type: 'text',
        text_content: '🔒 Encrypted message unavailable on this device.',
        media_url: undefined,
        correction_payload: undefined,
        correction_request_payload: undefined,
        status_reply_payload: undefined,
        encrypted_payload: undefined,
        is_end_to_end_encrypted: true,
        e2ee_unavailable: true,
      };
    }
  }

  async decryptRealtimePayload(payload: unknown): Promise<unknown> {
    if (!isRecord(payload) || !('message' in payload)) return payload;
    return {
      ...payload,
      message: await this.decryptMessage(payload['message']),
    };
  }

  private async decryptPayload(
    message: Record<string, unknown>,
    encrypted: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      encrypted['version'] !== 1 ||
      encrypted['algorithm'] !== ALGORITHM ||
      typeof encrypted['sender_device_id'] !== 'string' ||
      !isUuid(encrypted['sender_device_id']) ||
      !isPublicJwk(encrypted['sender_public_key']) ||
      typeof encrypted['nonce'] !== 'string' ||
      typeof encrypted['ciphertext'] !== 'string' ||
      !Array.isArray(encrypted['envelopes']) ||
      encrypted['envelopes'].length > 20 ||
      typeof message['room_id'] !== 'string' ||
      typeof message['message_type'] !== 'string'
    ) {
      throw new Error('Invalid encrypted message');
    }

    const identity = await this.getIdentity();
    const envelope = encrypted['envelopes'].find(
      (candidate) => isRecord(candidate) && candidate['device_id'] === identity.deviceId,
    );
    if (
      !isRecord(envelope) ||
      typeof envelope['nonce'] !== 'string' ||
      typeof envelope['wrapped_key'] !== 'string'
    ) {
      throw new Error('Encrypted history is unavailable on this device');
    }

    const wrappingKey = await this.deriveWrappingKey(
      identity.privateKey,
      encrypted['sender_public_key'],
      message['room_id'],
      encrypted['sender_device_id'],
      identity.deviceId,
    );
    const contentKeyBytes = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: decodeBase64Url(envelope['nonce'], 64),
          additionalData: this.envelopeAad(
            message['room_id'],
            encrypted['sender_device_id'],
            identity.deviceId,
          ),
        },
        wrappingKey,
        decodeBase64Url(envelope['wrapped_key'], 256),
      ),
    );
    if (contentKeyBytes.byteLength !== 32) {
      throw new Error('Invalid encrypted message key');
    }

    try {
      const contentKey = await crypto.subtle.importKey(
        'raw',
        contentKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );
      const plaintext = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: decodeBase64Url(encrypted['nonce'], 64),
            additionalData: this.contentAad(
              message['room_id'],
              message['message_type'],
              encrypted['sender_device_id'],
            ),
          },
          contentKey,
          decodeBase64Url(encrypted['ciphertext']),
        ),
      );
      if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
        throw new Error('Decrypted message is too large');
      }
      const parsed: unknown = JSON.parse(this.decoder.decode(plaintext));
      return this.sanitizeDecryptedContent(parsed);
    } finally {
      contentKeyBytes.fill(0);
    }
  }

  private sanitizeDecryptedContent(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) throw new Error('Invalid decrypted message');
    const result: Record<string, unknown> = {};

    const text = value['text_content'];
    if (text !== undefined) {
      if (typeof text !== 'string' || text.length > 10_000) throw new Error('Invalid text content');
      result['text_content'] = text;
    }

    const mediaUrl = value['media_url'];
    if (mediaUrl !== undefined) {
      if (typeof mediaUrl !== 'string' || mediaUrl.length > 3_000_000) {
        throw new Error('Invalid media content');
      }
      result['media_url'] = mediaUrl;
    }

    for (const key of ['correction_payload', 'correction_request_payload', 'status_reply_payload']) {
      if (value[key] !== undefined) {
        if (!isRecord(value[key])) throw new Error('Invalid structured message content');
        result[key] = value[key];
      }
    }
    return result;
  }

  private async deriveWrappingKey(
    privateKey: CryptoKey,
    peerJwk: E2eePublicKeyJwk,
    roomId: string,
    senderDeviceId: string,
    targetDeviceId: string,
  ): Promise<CryptoKey> {
    const peerKey = await crypto.subtle.importKey(
      'jwk',
      peerJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );
    const secret = new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, privateKey, 256),
    );
    try {
      const hkdfKey = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
      return await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: this.encoder.encode(`elgl-chat-room:${roomId}`),
          info: this.encoder.encode(
            `elgl-chat-envelope:v1:${senderDeviceId}:${targetDeviceId}`,
          ),
        },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    } finally {
      secret.fill(0);
    }
  }

  private contentAad(roomId: string, messageType: string, senderDeviceId: string): Uint8Array {
    return this.encoder.encode(`elgl-chat-content:v1:${roomId}:${messageType}:${senderDeviceId}`);
  }

  private envelopeAad(
    roomId: string,
    senderDeviceId: string,
    targetDeviceId: string,
  ): Uint8Array {
    return this.encoder.encode(
      `elgl-chat-envelope:v1:${roomId}:${senderDeviceId}:${targetDeviceId}`,
    );
  }

  private async getIdentity(): Promise<StoredIdentity> {
    if (!this.isSupported()) throw new Error('End-to-end encryption is unavailable in this browser');
    const userId = this.auth.currentUser()?.id;
    if (!userId) throw new Error('Encryption requires authentication');

    const pending = this.identityPromises.get(userId);
    if (pending) return pending;

    const created = this.loadOrCreateIdentity(userId);
    this.identityPromises.set(userId, created);
    try {
      return await created;
    } catch (error) {
      this.identityPromises.delete(userId);
      throw error;
    }
  }

  private async loadOrCreateIdentity(userId: string): Promise<StoredIdentity> {
    const stored = await this.readIdentity(userId);
    if (
      stored &&
      stored.userId === userId &&
      isUuid(stored.deviceId) &&
      stored.privateKey instanceof CryptoKey &&
      isPublicJwk(stored.publicKeyJwk)
    ) {
      return stored;
    }

    const generated = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    const exportedPrivate = new Uint8Array(await crypto.subtle.exportKey('pkcs8', generated.privateKey));
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      exportedPrivate,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
    exportedPrivate.fill(0);

    const rawPublicJwk = await crypto.subtle.exportKey('jwk', generated.publicKey);
    const publicKeyJwk: E2eePublicKeyJwk = {
      kty: 'EC',
      crv: 'P-256',
      x: rawPublicJwk.x ?? '',
      y: rawPublicJwk.y ?? '',
    };
    if (!isPublicJwk(publicKeyJwk)) throw new Error('Unable to create encryption identity');

    const identity: StoredIdentity = {
      userId,
      deviceId: crypto.randomUUID(),
      privateKey,
      publicKeyJwk,
    };
    await this.writeIdentity(identity);
    return identity;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(IDENTITY_STORE)) {
          request.result.createObjectStore(IDENTITY_STORE, { keyPath: 'userId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Encryption identity storage is unavailable'));
      request.onblocked = () => reject(new Error('Encryption identity storage is blocked'));
    });
  }

  private async readIdentity(userId: string): Promise<StoredIdentity | undefined> {
    const db = await this.openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(IDENTITY_STORE, 'readonly');
        const request = transaction.objectStore(IDENTITY_STORE).get(userId);
        request.onsuccess = () => resolve(request.result as StoredIdentity | undefined);
        request.onerror = () => reject(new Error('Encryption identity could not be read'));
      });
    } finally {
      db.close();
    }
  }

  private async writeIdentity(identity: StoredIdentity): Promise<void> {
    const db = await this.openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(IDENTITY_STORE, 'readwrite');
        transaction.objectStore(IDENTITY_STORE).put(identity);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Encryption identity could not be stored'));
        transaction.onabort = () => reject(new Error('Encryption identity storage was aborted'));
      });
    } finally {
      db.close();
    }
  }
}
