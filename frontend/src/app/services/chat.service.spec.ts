import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ChatService, ChatMessage } from './chat.service';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { OfflineQueueService } from './offline-queue.service';
import { NetworkStatusService } from './network-status.service';
import { HapticFeedbackService } from './haptic-feedback.service';
import { ChatCacheService } from './chat-cache.service';
import { PersonalChatEncryptionService } from './personal-chat-encryption.service';
import { I18nService } from './i18n.service';
import { toastsSignal } from './toast.service';
import { environment } from '../../environments/environment';

const baseUrl = `${environment.apiUrl}/chat`;

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let getAccessTokenMock: ReturnType<typeof vi.fn>;
  let getBlockedAndBlockerIdsMock: ReturnType<typeof vi.fn>;
  let getBlockedIdsAsyncMock: ReturnType<typeof vi.fn>;
  let enqueueMessageMock: ReturnType<typeof vi.fn>;
  let getQueuedMessagesMock: ReturnType<typeof vi.fn>;
  let removeMessageMock: ReturnType<typeof vi.fn>;
  let incrementRetryCountMock: ReturnType<typeof vi.fn>;
  let hapticTapMock: ReturnType<typeof vi.fn>;
  let getCachedRoomsMock: ReturnType<typeof vi.fn>;
  let translateMock: ReturnType<typeof vi.fn>;
  let online: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    currentUser = signal<{ id: string } | null>(null);
    currentUser.set({ id: 'user-1' });
    getAccessTokenMock = vi.fn().mockReturnValue('test-token');
    getBlockedAndBlockerIdsMock = vi.fn().mockResolvedValue([]);
    getBlockedIdsAsyncMock = vi.fn().mockResolvedValue([]);
    enqueueMessageMock = vi.fn().mockResolvedValue(undefined);
    getQueuedMessagesMock = vi.fn().mockResolvedValue([]);
    removeMessageMock = vi.fn().mockResolvedValue(undefined);
    incrementRetryCountMock = vi.fn().mockResolvedValue(undefined);
    hapticTapMock = vi.fn();
    getCachedRoomsMock = vi.fn().mockResolvedValue(null);
    translateMock = vi.fn((key: string) => key);
    // Offline by default so the automatic replay never races the explicit calls in these tests.
    online = signal(false);
    toastsSignal.set([]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) } as unknown as Router,
        },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            getAccessToken: getAccessTokenMock,
          } as unknown as AuthService,
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedAndBlockerIds: getBlockedAndBlockerIdsMock,
            getBlockedIdsAsync: getBlockedIdsAsyncMock,
          } as unknown as SafetyService,
        },
        {
          provide: OfflineQueueService,
          useValue: {
            enqueueMessage: enqueueMessageMock,
            getQueuedMessages: getQueuedMessagesMock,
            removeMessage: removeMessageMock,
            incrementRetryCount: incrementRetryCountMock,
          } as unknown as OfflineQueueService,
        },
        {
          provide: NetworkStatusService,
          useValue: { isOnline: online } as unknown as NetworkStatusService,
        },
        {
          provide: HapticFeedbackService,
          useValue: { tap: hapticTapMock } as unknown as HapticFeedbackService,
        },
        {
          provide: ChatCacheService,
          useValue: {
            getCachedMessages: vi.fn().mockReturnValue(Promise.resolve(null)),
            getCachedRooms: getCachedRoomsMock,
            getCachedFavourites: vi.fn().mockReturnValue(Promise.resolve(null)),
            cacheMessages: vi.fn().mockReturnValue(Promise.resolve()),
            cacheRooms: vi.fn().mockReturnValue(Promise.resolve()),
            cacheFavourites: vi.fn().mockReturnValue(Promise.resolve()),
            appendCachedMessage: vi.fn().mockReturnValue(Promise.resolve()),
            invalidateMessages: vi.fn().mockReturnValue(Promise.resolve()),
            invalidateRooms: vi.fn().mockReturnValue(Promise.resolve()),
            invalidateFavourites: vi.fn().mockReturnValue(Promise.resolve()),
          } as unknown as ChatCacheService,
        },
        {
          provide: PersonalChatEncryptionService,
          useValue: {
            isRoomE2eeCapable: vi.fn().mockResolvedValue(false),
            encryptMessage: vi.fn().mockImplementation((_r: string, text: string) =>
              Promise.resolve({
                ciphertext: text,
                iv: 'iv',
                payload: `e2ee:v1:iv:${text}`,
              }),
            ),
            encryptCachedMessage: vi.fn().mockImplementation((_r: string, text: string) =>
              Promise.resolve({
                ciphertext: text,
                iv: 'iv',
                payload: `e2ee:v1:iv:${text}`,
              }),
            ),
            decryptMessage: vi
              .fn()
              .mockImplementation((_r: string, env: string) => Promise.resolve(env)),
            clearKey: vi.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            translate: translateMock,
          },
        },
      ],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('labels', () => {
    it('should fetch and store labels', async () => {
      const promise = service.getLabels();

      const req = httpMock.expectOne(`${baseUrl}/labels`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(['fluent', 'favourite']);

      await expect(promise).resolves.toEqual(['fluent', 'favourite']);
    });

    it('should assign a label to a room', async () => {
      const promise = service.assignLabelToRoom('room-1', 'urgent');
      const req = httpMock.expectOne(`${baseUrl}/labels`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ room_id: 'room-1', label: 'urgent' });
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should remove a label from a room', async () => {
      const promise = service.removeLabelFromRoom('room-1', 'urgent');
      const req = httpMock.expectOne(`${baseUrl}/labels`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.body).toEqual({ room_id: 'room-1', label: 'urgent' });
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });
  });

  it('preserves receipt request failures instead of reporting fabricated empty status', async () => {
    const request = service.getMessageReceipts('message-1');
    const assertion = expect(request).rejects.toMatchObject({ status: 503 });
    httpMock
      .expectOne(`${baseUrl}/messages/message-1/receipts`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
  });

  describe('message search', () => {
    it('sends a trimmed, room-scoped request through the authenticated API', async () => {
      const messages: ChatMessage[] = [
        {
          id: 'message-1',
          room_id: 'room-1',
          sender_id: 'user-2',
          message_type: 'text',
          text_content: 'Hello there',
          is_read: true,
          created_at: '2026-11-02T00:00:00.000Z',
        },
      ];
      const promise = service.searchMessages('  hello  ', 'room-1', 25);

      const request = httpMock.expectOne(`${baseUrl}/search`);
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(request.request.body).toEqual({
        term: 'hello',
        roomId: 'room-1',
        limit: 25,
      });
      expect(request.request.params.keys()).toEqual([]);
      request.flush(messages);

      await expect(promise).resolves.toEqual(messages);
    });

    it('does not issue a private search request without an access token', async () => {
      getAccessTokenMock.mockReturnValue(null);

      await expect(service.searchMessages('hello', 'room-1')).resolves.toEqual([]);

      httpMock.expectNone(`${baseUrl}/search`);
    });

    it('decrypts encrypted candidates and applies the search term literally', async () => {
      const decryptMessage = TestBed.inject(PersonalChatEncryptionService).decryptMessage;
      vi.mocked(decryptMessage).mockResolvedValueOnce('Meet at ** noon');
      const promise = service.searchMessages('**', 'room-1');

      httpMock.expectOne(`${baseUrl}/search`).flush([
        {
          id: 'encrypted-match',
          room_id: 'room-1',
          sender_id: 'user-2',
          message_type: 'text',
          text_content: 'Encrypted message',
          is_encrypted: true,
          encrypted_payload: 'e2ee:v1:iv:ciphertext',
          is_read: true,
          created_at: '2026-11-02T00:00:00.000Z',
        },
        {
          id: 'encrypted-non-match',
          room_id: 'room-1',
          sender_id: 'user-2',
          message_type: 'text',
          text_content: 'Encrypted message',
          is_encrypted: true,
          encrypted_payload: 'e2ee:v1:iv:other',
          is_read: true,
          created_at: '2026-11-01T00:00:00.000Z',
        },
      ]);

      await expect(promise).resolves.toEqual([
        expect.objectContaining({
          id: 'encrypted-match',
          text_content: 'Meet at ** noon',
        }),
      ]);
    });
  });

  describe('blocked users', () => {
    it('should track blocked users locally', () => {
      expect(service.isUserBlocked()('user-1')).toBe(false);

      service.addBlockedUser('user-1');
      expect(service.isUserBlocked()('user-1')).toBe(true);
      expect(service.getBlockedUsers()).toEqual(['user-1']);

      service.removeBlockedUser('user-1');
      expect(service.isUserBlocked()('user-1')).toBe(false);
      expect(service.getBlockedUsers()).toEqual([]);
    });

    it('should load blocked users from the safety service', async () => {
      getBlockedIdsAsyncMock.mockResolvedValue(['blocked-1', 'blocked-2']);

      await service.loadBlockedUsers();

      expect(service.getBlockedUsers()).toEqual(['blocked-1', 'blocked-2']);
    });

    it('should swallow errors when loading blocked users fails', async () => {
      getBlockedIdsAsyncMock.mockRejectedValue(new Error('network error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.loadBlockedUsers()).resolves.toBeUndefined();
    });

    it('should report block status from the API', async () => {
      const promise = service.isBlocked('user-1');

      const req = httpMock.expectOne(`${environment.apiUrl}/safety/is-blocked/user-1`);
      expect(req.request.method).toBe('GET');
      req.flush({ blocked: true });

      await expect(promise).resolves.toBe(true);
    });

    it('should return false when the block status check fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const promise = service.isBlocked('user-1');

      const req = httpMock.expectOne(`${environment.apiUrl}/safety/is-blocked/user-1`);
      req.flush('error', { status: 500, statusText: 'Internal Server Error' });

      await expect(promise).resolves.toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should send a text message online', async () => {
      currentUser.set({ id: 'user-1' });
      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const membersReq = httpMock.expectOne(`${baseUrl}/rooms/room-1/members`);
      membersReq.flush([{ user_id: 'user-1' }, { user_id: 'user-2' }]);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const sentMessage: ChatMessage = {
        id: 'm1',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'text',
        text_content: 'hi',
        is_read: false,
        created_at: '2026-08-01T00:00:00.000Z',
      };
      const sendReq = httpMock.expectOne(`${baseUrl}/messages`);
      expect(sendReq.request.method).toBe('POST');
      sendReq.flush(sentMessage);

      await expect(promise).resolves.toEqual(sentMessage);
      expect(hapticTapMock).toHaveBeenCalled();
    });

    it('should encrypt personal message when room is E2EE capable', async () => {
      const encryption = TestBed.inject(PersonalChatEncryptionService);
      vi.mocked(encryption.isRoomE2eeCapable).mockResolvedValueOnce(true);

      currentUser.set({ id: 'user-1' });
      const promise = service.sendMessage({
        room_id: 'direct-room-1',
        message_type: 'text',
        text_content: 'Secret personal message',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const membersReq = httpMock.expectOne(`${baseUrl}/rooms/direct-room-1/members`);
      membersReq.flush([{ user_id: 'user-1' }, { user_id: 'user-2' }]);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const sendReq = httpMock.expectOne(`${baseUrl}/messages`);
      expect(sendReq.request.method).toBe('POST');
      expect(sendReq.request.body.is_encrypted).toBe(true);
      expect(sendReq.request.body.encrypted_payload).toBe('e2ee:v1:iv:Secret personal message');

      const serverResponse: ChatMessage = {
        id: 'm-enc-1',
        room_id: 'direct-room-1',
        sender_id: 'user-1',
        message_type: 'text',
        text_content: 'e2ee:v1:iv:Secret personal message',
        is_encrypted: true,
        encrypted_payload: 'e2ee:v1:iv:Secret personal message',
        is_read: false,
        created_at: '2026-08-01T00:00:00.000Z',
      };
      sendReq.flush(serverResponse);

      const result = await promise;
      // Expect plaintext restored for display
      expect(result.text_content).toBe('Secret personal message');
      expect(result.is_encrypted).toBe(true);
    });

    it('should reject sending to a blocked receiver', async () => {
      currentUser.set({ id: 'user-1' });
      getBlockedAndBlockerIdsMock.mockResolvedValue(['user-2']);

      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const membersReq = httpMock.expectOne(`${baseUrl}/rooms/room-1/members`);
      membersReq.flush([{ user_id: 'user-1' }, { user_id: 'user-2' }]);

      await expect(promise).rejects.toThrow('You cannot send messages to this user.');
    });

    it('fails closed when direct-room key retrieval is unavailable', async () => {
      const encryption = TestBed.inject(PersonalChatEncryptionService);
      vi.mocked(encryption.isRoomE2eeCapable).mockRejectedValueOnce(
        new Error('key broker unavailable'),
      );

      await expect(
        service.sendMessage({
          room_id: 'direct-room-1',
          message_type: 'text',
          text_content: 'must stay private',
        }),
      ).rejects.toThrow('key broker unavailable');
      httpMock.expectNone(`${baseUrl}/messages`);
    });

    it('should queue the message when offline instead of calling the API', async () => {
      currentUser.set({ id: 'user-1' });
      vi.stubGlobal('navigator', { onLine: false });
      getCachedRoomsMock.mockResolvedValueOnce([{ id: 'room-1', admin_id: 'group-admin' }]);

      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      // Offline path short-circuits BEFORE any HTTP calls, including room members
      const queued = await promise;
      expect(queued.room_id).toBe('room-1');
      expect(queued.text_content).toBe('hi');
      expect(enqueueMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ room_id: 'room-1' }),
      );
      expect(hapticTapMock).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('encrypts a direct message before persisting it to the offline queue', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      getCachedRoomsMock.mockResolvedValueOnce([{ id: 'direct-room-1', admin_id: null }]);

      const queued = await service.sendMessage({
        room_id: 'direct-room-1',
        message_type: 'text',
        text_content: 'private offline text',
      });

      expect(enqueueMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text_content: 'e2ee:v1:iv:private offline text',
          is_encrypted: true,
          encrypted_payload: 'e2ee:v1:iv:private offline text',
        }),
      );
      expect(queued.text_content).toBe('private offline text');

      vi.unstubAllGlobals();
    });
  });

  describe('getMessages', () => {
    it('should fetch messages and filter out blocked senders', async () => {
      currentUser.set({ id: 'user-1' });
      getBlockedAndBlockerIdsMock.mockResolvedValue(['blocked-sender']);

      const promise = service.getMessages('room-1');

      // Allow cache-check microtask to settle before the HTTP call is issued
      await new Promise((r) => setTimeout(r, 0));

      const req = httpMock.expectOne((r) => r.url === `${baseUrl}/messages/room-1`);
      expect(req.request.method).toBe('GET');
      req.flush([
        {
          id: '1',
          room_id: 'room-1',
          sender_id: 'blocked-sender',
          message_type: 'text',
          is_read: false,
          created_at: 'now',
        },
        {
          id: '2',
          room_id: 'room-1',
          sender_id: 'user-2',
          message_type: 'text',
          is_read: false,
          created_at: 'now',
        },
      ]);

      const messages = await promise;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('2');
    });

    it('should include a trimmed search param when provided', async () => {
      const promise = service.getMessages('room-1', '  hello  ');

      // Allow microtask to settle
      await new Promise((r) => setTimeout(r, 0));

      const req = httpMock.expectOne(
        (r) => r.url === `${baseUrl}/messages/room-1` && r.params.get('search') === 'hello',
      );
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });
  });

  describe('syncOfflineMessages', () => {
    const queued = (
      id: string,
      roomId = 'room-1',
      overrides: Partial<ChatMessage> = {},
    ): ChatMessage => ({
      id,
      room_id: roomId,
      sender_id: 'user-1',
      message_type: 'text',
      text_content: `text ${id}`,
      is_read: false,
      created_at: '2026-10-31T00:00:00.000Z',
      ...overrides,
    });

    /** Lets the replay run until it is waiting on its next HTTP request. */
    const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    const emptyResult = { sent: 0, failed: 0, rejected: 0 };
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('preserves encrypted envelopes when flushing the offline queue', async () => {
      getQueuedMessagesMock.mockResolvedValueOnce([
        {
          id: 'queued-1',
          room_id: 'direct-room-1',
          sender_id: 'user-1',
          message_type: 'text',
          text_content: 'e2ee:v1:iv:ciphertext',
          is_encrypted: true,
          encrypted_payload: 'e2ee:v1:iv:ciphertext',
          is_read: false,
          created_at: '2026-10-31T00:00:00.000Z',
        },
      ]);

      const sync = service.syncOfflineMessages();
      await Promise.resolve();
      const request = httpMock.expectOne(`${baseUrl}/messages`);
      expect(request.request.body).toEqual(
        expect.objectContaining({
          is_encrypted: true,
          encrypted_payload: 'e2ee:v1:iv:ciphertext',
        }),
      );
      request.flush({ id: 'server-message-1' });

      await expect(sync).resolves.toEqual({ sent: 1, failed: 0, rejected: 0 });
      expect(removeMessageMock).toHaveBeenCalledWith('queued-1');
    });

    it('sends the queue id as the idempotency key and never the local ownership fields', async () => {
      getQueuedMessagesMock.mockResolvedValueOnce([queued('11111111-1111-4111-8111-111111111111')]);

      const sync = service.syncOfflineMessages();
      await settle();
      const request = httpMock.expectOne(`${baseUrl}/messages`);

      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(request.request.body).toEqual(
        expect.objectContaining({
          room_id: 'room-1',
          message_type: 'text',
          text_content: 'text 11111111-1111-4111-8111-111111111111',
          client_message_id: '11111111-1111-4111-8111-111111111111',
        }),
      );
      expect(request.request.body).not.toHaveProperty('id');
      expect(request.request.body).not.toHaveProperty('sender_id');
      expect(request.request.body).not.toHaveProperty('created_at');
      request.flush({ id: '11111111-1111-4111-8111-111111111111' });

      await expect(sync).resolves.toEqual({ sent: 1, failed: 0, rejected: 0 });
    });

    it('shares one replay between overlapping triggers so a message is sent once', async () => {
      getQueuedMessagesMock.mockResolvedValue([queued('m1')]);

      const first = service.syncOfflineMessages();
      const second = service.syncOfflineMessages();
      expect(second).toBe(first);

      await settle();
      httpMock.expectOne(`${baseUrl}/messages`).flush({ id: 'm1' });
      await expect(first).resolves.toEqual({ sent: 1, failed: 0, rejected: 0 });
      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(1);

      // Once the replay has finished a later trigger starts a new one.
      getQueuedMessagesMock.mockResolvedValue([]);
      await expect(service.syncOfflineMessages()).resolves.toEqual(emptyResult);
      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(2);
    });

    it('sends queued messages oldest first, one request at a time', async () => {
      getQueuedMessagesMock.mockResolvedValue([queued('m1'), queued('m2')]);

      const sync = service.syncOfflineMessages();
      await settle();
      const first = httpMock.expectOne(`${baseUrl}/messages`);
      expect(first.request.body.client_message_id).toBe('m1');
      first.flush({ id: 'm1' });

      await settle();
      const second = httpMock.expectOne(`${baseUrl}/messages`);
      expect(second.request.body.client_message_id).toBe('m2');
      second.flush({ id: 'm2' });

      await expect(sync).resolves.toEqual({ sent: 2, failed: 0, rejected: 0 });
      expect(removeMessageMock.mock.calls.map(([id]) => id)).toEqual(['m1', 'm2']);
    });

    it('holds back later messages of a room after a transient failure but still serves other rooms', async () => {
      getQueuedMessagesMock.mockResolvedValue([
        queued('a1', 'room-a'),
        queued('a2', 'room-a'),
        queued('b1', 'room-b'),
      ]);

      const sync = service.syncOfflineMessages();
      await settle();
      httpMock
        .expectOne(`${baseUrl}/messages`)
        .flush({}, { status: 503, statusText: 'Unavailable' });
      await settle();
      // a2 is not attempted: it would overtake the failed a1 in room-a.
      const other = httpMock.expectOne(`${baseUrl}/messages`);
      expect(other.request.body.client_message_id).toBe('b1');
      other.flush({ id: 'b1' });

      await expect(sync).resolves.toEqual({ sent: 1, failed: 2, rejected: 0 });
      expect(removeMessageMock).toHaveBeenCalledTimes(1);
      expect(removeMessageMock).toHaveBeenCalledWith('b1');
      expect(warnSpy).toHaveBeenCalledWith('chat.offline_sync_incomplete', {
        sent: 1,
        failed: 2,
        rejected: 0,
      });
      expect(toastsSignal()).toEqual([]);
    });

    it.each([0, 401, 408, 425, 429, 500, 502, 503])(
      'keeps the message queued after a retryable %s response',
      async (status) => {
        getQueuedMessagesMock.mockResolvedValue([queued('m1')]);

        const sync = service.syncOfflineMessages();
        await settle();
        const request = httpMock.expectOne(`${baseUrl}/messages`);
        if (status === 0) {
          request.error(new ProgressEvent('error'));
        } else {
          request.flush({}, { status, statusText: 'Retry later' });
        }

        await expect(sync).resolves.toEqual({ sent: 0, failed: 1, rejected: 0 });
        expect(removeMessageMock).not.toHaveBeenCalled();
        expect(toastsSignal()).toEqual([]);
      },
    );

    it.each([400, 403, 404, 409, 413, 422])(
      'removes a message the server permanently refuses with %s and still sends later ones',
      async (status) => {
        getQueuedMessagesMock.mockResolvedValue([queued('bad'), queued('good')]);

        const sync = service.syncOfflineMessages();
        await settle();
        httpMock
          .expectOne(`${baseUrl}/messages`)
          .flush({ message: 'refused' }, { status, statusText: 'Refused' });
        await settle();
        const next = httpMock.expectOne(`${baseUrl}/messages`);
        expect(next.request.body.client_message_id).toBe('good');
        next.flush({ id: 'good' });

        await expect(sync).resolves.toEqual({ sent: 1, failed: 0, rejected: 1 });
        expect(removeMessageMock.mock.calls.map(([id]) => id)).toEqual(['bad', 'good']);
        expect(translateMock).toHaveBeenCalledWith('chatRoom.offlineMessagesRejected', {
          count: 1,
        });
        expect(toastsSignal()).toEqual([
          expect.objectContaining({ type: 'error', message: 'chatRoom.offlineMessagesRejected' }),
        ]);
      },
    );

    it('retries a delivered message whose dequeue failed, relying on the idempotent API', async () => {
      removeMessageMock.mockRejectedValueOnce(new Error('storage failure'));
      getQueuedMessagesMock.mockResolvedValue([queued('m1'), queued('m2')]);

      const first = service.syncOfflineMessages();
      await settle();
      httpMock.expectOne(`${baseUrl}/messages`).flush({ id: 'm1' });

      // m2 is held back because m1 is still queued.
      await expect(first).resolves.toEqual({ sent: 0, failed: 2, rejected: 0 });
      httpMock.expectNone(`${baseUrl}/messages`);

      const second = service.syncOfflineMessages();
      await settle();
      const resend = httpMock.expectOne(`${baseUrl}/messages`);
      expect(resend.request.body.client_message_id).toBe('m1');
      resend.flush({ id: 'm1' });
      await settle();
      httpMock.expectOne(`${baseUrl}/messages`).flush({ id: 'm2' });

      await expect(second).resolves.toEqual({ sent: 2, failed: 0, rejected: 0 });
    });

    it('does nothing without a session', async () => {
      getAccessTokenMock.mockReturnValue(null);
      getQueuedMessagesMock.mockResolvedValue([queued('m1')]);

      await expect(service.syncOfflineMessages()).resolves.toEqual(emptyResult);
      expect(getQueuedMessagesMock).not.toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/messages`);
    });

    it('reports an unreadable queue with a fixed diagnostic that carries no private content', async () => {
      getQueuedMessagesMock.mockRejectedValue(new Error('private message text'));

      await expect(service.syncOfflineMessages()).resolves.toEqual(emptyResult);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('chat.offline_queue_unreadable');
      httpMock.expectNone(`${baseUrl}/messages`);
    });
  });

  describe('automatic offline replay', () => {
    const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('replays when a signed-in account gains connectivity', async () => {
      online.set(true);
      TestBed.tick();
      await settle();

      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(1);
    });

    it('replays again each time connectivity returns', async () => {
      online.set(true);
      TestBed.tick();
      await settle();
      online.set(false);
      TestBed.tick();
      await settle();
      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(1);

      online.set(true);
      TestBed.tick();
      await settle();
      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(2);
    });

    it('does not replay for a signed-out browser', async () => {
      currentUser.set(null);
      online.set(true);
      TestBed.tick();
      await settle();

      expect(getQueuedMessagesMock).not.toHaveBeenCalled();
    });

    it('replays messages left by a previous session once the account signs in', async () => {
      currentUser.set(null);
      online.set(true);
      TestBed.tick();
      await settle();
      expect(getQueuedMessagesMock).not.toHaveBeenCalled();

      currentUser.set({ id: 'user-1' });
      TestBed.tick();
      await settle();
      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(1);
    });

    it('does not replay again when the account object refreshes while staying signed in', async () => {
      online.set(true);
      TestBed.tick();
      await settle();

      currentUser.set({ id: 'user-1' });
      TestBed.tick();
      await settle();

      expect(getQueuedMessagesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUnreadCount', () => {
    it('should fetch and validate the unread count', async () => {
      const promise = service.getUnreadCount();

      const req = httpMock.expectOne(`${baseUrl}/unread-count`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ unreadCount: 7 });

      await expect(promise).resolves.toBe(7);
    });

    it('should reject an invalid unread count response', async () => {
      const promise = service.getUnreadCount();
      httpMock.expectOne(`${baseUrl}/unread-count`).flush({ unreadCount: -1 });

      await expect(promise).rejects.toThrow('Invalid unread count response');
    });
  });

  describe('rooms', () => {
    it('should fetch chat rooms', async () => {
      const promise = service.getRooms();

      // Allow cache-check microtask to settle
      await new Promise((r) => setTimeout(r, 0));

      const req = httpMock.expectOne(`${baseUrl}/rooms`);
      expect(req.request.method).toBe('GET');
      req.flush([
        {
          id: 'room-1',
          title: 'Room',
          subtitle: '',
          avatar: '',
          is_online: true,
          is_pinned: false,
          created_at: 'now',
        },
      ]);

      await expect(promise).resolves.toHaveLength(1);
    });
  });

  describe('replyToStatusUpdate', () => {
    it('should POST the reply and return the created message', async () => {
      const promise = service.replyToStatusUpdate({
        target_user_id: 'user-2',
        status_update_id: 'status-1',
        status_text: 'hello world',
      });

      const req = httpMock.expectOne(`${baseUrl}/messages/status-reply`);
      expect(req.request.method).toBe('POST');
      const message: ChatMessage = {
        id: 'm1',
        room_id: 'room-1',
        sender_id: 'user-1',
        message_type: 'status_reply',
        is_read: false,
        created_at: 'now',
      };
      req.flush(message);

      await expect(promise).resolves.toEqual(message);
      expect(hapticTapMock).toHaveBeenCalled();
    });

    it('should wrap errors with a friendly message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const promise = service.replyToStatusUpdate({
        target_user_id: 'user-2',
        status_update_id: 'status-1',
        status_text: 'hello world',
      });

      const req = httpMock.expectOne(`${baseUrl}/messages/status-reply`);
      req.flush('error', { status: 500, statusText: 'Internal Server Error' });

      await expect(promise).rejects.toThrow(
        'Could not send reply to status update. Please try again.',
      );
    });
  });

  describe('chat lock', () => {
    it('should lock a chat room', async () => {
      const promise = service.lockChat('room-1');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/lock`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should unlock a chat room', async () => {
      const promise = service.unlockChat('room-1');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/unlock`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should fetch locked room ids', async () => {
      const promise = service.getLockedRoomIds();
      const req = httpMock.expectOne(`${baseUrl}/locked-rooms`);
      req.flush(['room-1']);

      await expect(promise).resolves.toEqual(['room-1']);
    });
  });

  describe('correctMessage and fixMessage', () => {
    it('should POST a correction for a message', async () => {
      const promise = service.correctMessage('msg-1', 'corrected text', 'explanation');
      const req = httpMock.expectOne(`${baseUrl}/messages/msg-1/correct`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        correctedText: 'corrected text',
        explanation: 'explanation',
      });
      req.flush({ id: 'msg-1' });

      await expect(promise).resolves.toEqual({ id: 'msg-1' });
    });

    it('should PATCH a fix for a message', async () => {
      const promise = service.fixMessage('msg-1', 'corrected text');
      const req = httpMock.expectOne(`${baseUrl}/messages/msg-1/fix`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ id: 'msg-1' });

      await expect(promise).resolves.toEqual({ id: 'msg-1' });
    });
  });

  describe('groups', () => {
    it('should create a group', async () => {
      const promise = service.createGroup('Study Group', ['user-1', 'user-2']);
      const req = httpMock.expectOne(`${baseUrl}/groups`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Study Group', memberIds: ['user-1', 'user-2'] });
      req.flush({ id: 'room-1' });

      await expect(promise).resolves.toEqual({ id: 'room-1' });
    });

    it('should rename a group', async () => {
      const promise = service.renameGroup('room-1', 'New Name');
      const req = httpMock.expectOne(`${baseUrl}/groups/room-1/rename`);
      expect(req.request.method).toBe('PATCH');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should add group members', async () => {
      const promise = service.addGroupMembers('room-1', ['user-3']);
      const req = httpMock.expectOne(`${baseUrl}/groups/room-1/members`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should remove a group member', async () => {
      const promise = service.removeGroupMember('room-1', 'user-3');
      const req = httpMock.expectOne(`${baseUrl}/groups/room-1/members/user-3`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should fetch group members', async () => {
      const promise = service.getGroupMembers('room-1');
      const req = httpMock.expectOne(`${baseUrl}/groups/room-1/members`);
      req.flush([{ user_id: 'user-1' }]);

      await expect(promise).resolves.toEqual([{ user_id: 'user-1' }]);
    });

    it('should fetch room members', async () => {
      const promise = service.getRoomMembers('room-1');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/members`);
      req.flush([{ user_id: 'user-1', display_name: 'Alice' }]);

      await expect(promise).resolves.toEqual([{ user_id: 'user-1', display_name: 'Alice' }]);
    });
  });

  describe('translation and suggestions', () => {
    it('should translate text', async () => {
      const promise = service.translateText('hello', 'fr');
      const req = httpMock.expectOne(`${environment.apiUrl}/nlp/translate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ text: 'hello', target_language: 'fr' });
      req.flush({ translated_text: 'bonjour' });

      await expect(promise).resolves.toEqual({ translated_text: 'bonjour' });
    });

    it('should translate voiceroom text', async () => {
      const promise = service.translateVoiceroomText('hello', 'fr');
      const req = httpMock.expectOne(`${environment.apiUrl}/chat/translate-voiceroom`);
      req.flush({ translated_text: 'bonjour', detected_language: 'en' });

      await expect(promise).resolves.toEqual({
        translated_text: 'bonjour',
        detected_language: 'en',
      });
    });

    it('should fetch suggested replies with mapped recent messages', async () => {
      const recentMessages: ChatMessage[] = [
        {
          id: '1',
          room_id: 'room-1',
          sender_id: 'user-1',
          message_type: 'text',
          text_content: 'hi',
          is_read: true,
          created_at: 'now',
        },
      ];
      const promise = service.getSuggestedReplies('room-1', recentMessages);

      const req = httpMock.expectOne(`${baseUrl}/suggested-replies`);
      expect(req.request.body).toEqual({
        room_id: 'room-1',
        recent_messages: [{ sender_id: 'user-1', text: 'hi' }],
      });
      req.flush({ suggestions: ['Sounds good!'] });

      await expect(promise).resolves.toEqual(['Sounds good!']);
    });

    it('should fetch conversation starters', async () => {
      const promise = service.getConversationStarters('partner-1');
      const req = httpMock.expectOne(`${baseUrl}/conversation-starters`);
      expect(req.request.body).toEqual({ partnerId: 'partner-1' });
      req.flush({ suggestions: ['What is your favourite hobby?'] });

      await expect(promise).resolves.toEqual(['What is your favourite hobby?']);
    });
  });

  describe('exportChatHistory', () => {
    it('should fetch the full message history for export', async () => {
      const promise = service.exportChatHistory('room-1');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/export`);
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
    });
  });

  describe('reporting (fetch based)', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should report a message', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      vi.stubGlobal('window', { location: { href: 'https://example.com/chat/room-1' } });

      await service.reportMessage('msg-1', 'spam');

      expect(mockFetch).toHaveBeenCalledWith(
        '/safety/report',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            reported_id: 'msg-1',
            reason: 'spam',
            context_url: 'https://example.com/chat/room-1',
          }),
        }),
      );
    });

    it('should throw when reporting a message fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      vi.stubGlobal('window', { location: { href: 'https://example.com/chat/room-1' } });

      await expect(service.reportMessage('msg-1', 'spam')).rejects.toThrow(
        'Failed to report message',
      );
    });
  });

  describe('downloadChatHistory', () => {
    it('should do nothing when window is undefined', async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error simulating a non-browser environment
      delete globalThis.window;

      await expect(service.downloadChatHistory('room-1')).resolves.toBeUndefined();

      globalThis.window = originalWindow;
    });
  });
});
