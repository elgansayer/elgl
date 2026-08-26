import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ChatE2eeService } from './chat-e2ee.service';

describe('ChatE2eeService', () => {
  let service: ChatE2eeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatE2eeService,
        { provide: HttpClient, useValue: {} },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            getAccessToken: () => null,
          },
        },
      ],
    });
    service = TestBed.inject(ChatE2eeService);
  });

  it('recognises only versioned encrypted persisted messages', () => {
    expect(
      service.isEncryptedStoredMessage({
        room_id: 'room-1',
        message_type: 'encrypted',
        encryption_version: 1,
        encrypted_payload: 'abc',
        encryption_iv: 'def',
        encryption_envelopes: [],
      }),
    ).toBe(true);
    expect(
      service.isEncryptedStoredMessage({
        message_type: 'encrypted',
        encryption_version: 2,
        encrypted_payload: 'abc',
      }),
    ).toBe(false);
  });

  it('renders ciphertext as an unavailable encrypted message when browser crypto is unavailable', async () => {
    const originalIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
    try {
      const result = (await service.decryptMessage({
        id: 'message-1',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'encrypted',
        encryption_version: 1,
        encrypted_payload: 'abc',
        encryption_iv: 'def',
        encryption_envelopes: [],
      })) as Record<string, unknown>;

      expect(result['message_type']).toBe('text');
      expect(result['text_content']).toContain('Encrypted message unavailable');
      expect(result['encrypted_payload']).toBeUndefined();
      expect(result['is_end_to_end_encrypted']).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: originalIndexedDb,
      });
    }
  });
});
