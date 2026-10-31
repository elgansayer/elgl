import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { E2eeService } from './e2ee.service';

describe('E2eeService', () => {
  let service: E2eeService;
  let httpMock: HttpTestingController;

  const mockAuthService = {
    getAccessToken: () => 'test-token',
    currentUser: () => ({ id: 'alice-id', display_name: 'Alice' }),
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        E2eeService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(E2eeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('generates, stores, and publishes an ECDH keypair for the user', async () => {
    const initPromise = service.initialiseUserKeys('alice-id');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/keys`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toHaveProperty('public_key');
    expect(req.request.body.public_key).toHaveProperty('kty', 'EC');
    req.flush({ success: true });

    await initPromise;

    expect(localStorage.getItem('e2ee_priv_alice-id')).toBeTruthy();
    expect(localStorage.getItem('e2ee_pub_alice-id')).toBeTruthy();
  });

  it('performs end-to-end encryption and mutual decryption between two participants', async () => {
    // 1. Initialise Alice's keys
    const aliceInit = service.initialiseUserKeys('alice-id');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const aliceKeyReq = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/keys`);
    const alicePubKey = aliceKeyReq.request.body.public_key;
    aliceKeyReq.flush({ success: true });
    await aliceInit;

    // 2. Generate Bob's keypair using Web Crypto
    const bobKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );
    const bobPubKeyJwk = await window.crypto.subtle.exportKey('jwk', bobKeyPair.publicKey);

    // 3. Alice encrypts a message for Bob
    const encryptPromise = service.encryptMessage('Confidential practice text', 'bob-id');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const bobKeyReq = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/keys/bob-id`);
    bobKeyReq.flush({ public_key: bobPubKeyJwk });

    const encrypted = await encryptPromise;
    expect(encrypted).not.toBeNull();
    expect(encrypted?.is_encrypted).toBe(true);
    expect(encrypted?.ciphertext).not.toBe('Confidential practice text');
    expect(encrypted?.iv).toBeTruthy();

    // 4. Bob derives the same shared key with Alice's public key
    const aliceImportedPubKey = await window.crypto.subtle.importKey(
      'jwk',
      alicePubKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );
    const bobSharedKey = await window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: aliceImportedPubKey },
      bobKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );

    // 5. Bob decrypts Alice's ciphertext
    const binaryCipher = atob(encrypted!.ciphertext);
    const cipherBytes = new Uint8Array(binaryCipher.length);
    for (let i = 0; i < binaryCipher.length; i++) {
      cipherBytes[i] = binaryCipher.charCodeAt(i);
    }

    const binaryIv = atob(encrypted!.iv);
    const ivBytes = new Uint8Array(binaryIv.length);
    for (let i = 0; i < binaryIv.length; i++) {
      ivBytes[i] = binaryIv.charCodeAt(i);
    }

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      bobSharedKey,
      cipherBytes,
    );
    const decryptedText = new TextDecoder().decode(decryptedBuffer);

    expect(decryptedText).toBe('Confidential practice text');
  });

  it('returns fallback string when decryption fails due to tampering', async () => {
    // Initialise keys
    const init = service.initialiseUserKeys('alice-id');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const req = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/keys`);
    req.flush({ success: true });
    await init;

    const decryptPromise = service.decryptMessage('corrupted-ciphertext', 'dGVzdC1pdi0xMjM0', 'peer-id', 'room-1');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const peerReq = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/keys/peer-id`);
    peerReq.flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const roomKeyReq = httpMock.expectOne(`${environment.apiUrl}/chat/e2ee/rooms/room-1/key`);
    roomKeyReq.flush({ encrypted_key: 'dGVzdC1rZXktbWF0ZXJpYWwtMzItYnl0ZXMxMjM0NTY3ODkwMTI=' });

    const result = await decryptPromise;
    expect(result).toBe('[Encrypted message]');
  });
});
