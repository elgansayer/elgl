import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';

describe('PersonalChatEncryptionService', () => {
  let service: PersonalChatEncryptionService;
  let httpMock: HttpTestingController;
  let mockAuthService: {
    getAccessToken: ReturnType<typeof vi.fn>;
  };

  const testRoomId = '22222222-3333-4444-8888-999999999999';
  // 32-byte key base64url encoded
  const testKeyBase64url = 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE';

  beforeEach(() => {
    mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PersonalChatEncryptionService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    });

    service = TestBed.inject(PersonalChatEncryptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches and imports an AES-256-GCM CryptoKey for the room', async () => {
    const keyPromise = service.getOrFetchRoomKey(testRoomId);

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-jwt-token');

    req.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });

    const key = await keyPromise;
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('caches the CryptoKey and avoids repeated HTTP requests', async () => {
    const firstPromise = service.getOrFetchRoomKey(testRoomId);

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    req.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });

    const key1 = await firstPromise;
    const key2 = await service.getOrFetchRoomKey(testRoomId);

    expect(key1).toBe(key2);
    httpMock.expectNone(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
  });

  it('treats an unsupported key request as a non-encrypted group room', async () => {
    const capable = service.isRoomE2eeCapable(testRoomId);
    httpMock
      .expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`)
      .flush({}, { status: 422, statusText: 'Unprocessable Entity' });

    await expect(capable).resolves.toBe(false);
  });

  it('does not downgrade to plaintext when key access is forbidden', async () => {
    const capable = service.isRoomE2eeCapable(testRoomId);
    httpMock
      .expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`)
      .flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(capable).rejects.toMatchObject({ status: 403 });
  });

  it('does not downgrade to plaintext when the key broker is unavailable', async () => {
    const capable = service.isRoomE2eeCapable(testRoomId);
    httpMock
      .expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`)
      .flush({}, { status: 503, statusText: 'Unavailable' });

    await expect(capable).rejects.toMatchObject({ status: 503 });
  });

  it('rejects key material bound to another room', async () => {
    const keyPromise = service.getOrFetchRoomKey(testRoomId);
    httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`).flush({
      e2ee_key: testKeyBase64url,
      room_id: 'another-room',
      algorithm: 'AES-GCM-256',
    });

    await expect(keyPromise).rejects.toThrow('No E2EE key material returned');
  });

  it('encrypts and decrypts messages end-to-end', async () => {
    const plainText = 'Confidential message for HelloTalk language exchange!';

    const encryptPromise = service.encryptMessage(testRoomId, plainText);

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    req.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });

    const encrypted = await encryptPromise;
    expect(encrypted.payload.startsWith('e2ee:v1:')).toBe(true);
    expect(service.isEncryptedPayload(encrypted.payload)).toBe(true);

    const decrypted = await service.decryptMessage(testRoomId, encrypted.payload);
    expect(decrypted).toBe(plainText);
  });

  it('returns plaintext unchanged if not an encrypted envelope', async () => {
    const plainText = 'Regular unencrypted message';
    const result = await service.decryptMessage(testRoomId, plainText);
    expect(result).toBe(plainText);
  });

  it('fails decryption when ciphertext has been tampered with', async () => {
    const plainText = 'Authentic message';
    const encryptPromise = service.encryptMessage(testRoomId, plainText);

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    req.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });

    const encrypted = await encryptPromise;
    const parts = encrypted.payload.split(':');
    // Corrupt ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA${parts[3] || 'ZZ'}`;

    await expect(service.decryptMessage(testRoomId, tampered)).rejects.toThrow();
  });

  it('rejects malformed encrypted envelopes instead of rendering them', async () => {
    await expect(service.decryptMessage(testRoomId, 'e2ee:v1:not-valid')).rejects.toThrow(
      'Malformed encryption envelope.',
    );
  });

  it('refuses offline encryption when no in-memory room key exists', async () => {
    await expect(service.encryptCachedMessage(testRoomId, 'secret')).rejects.toThrow(
      'encrypted room key is unavailable',
    );
  });

  it('clears in-memory keys on clearKey call', async () => {
    const firstPromise = service.getOrFetchRoomKey(testRoomId);
    const req1 = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    req1.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });
    await firstPromise;

    service.clearKey(testRoomId);

    const secondPromise = service.getOrFetchRoomKey(testRoomId);
    const req2 = httpMock.expectOne(`${environment.apiUrl}/chat/rooms/${testRoomId}/e2ee-key`);
    req2.flush({
      e2ee_key: testKeyBase64url,
      room_id: testRoomId,
      algorithm: 'AES-GCM-256',
    });
    await secondPromise;
  });
});
