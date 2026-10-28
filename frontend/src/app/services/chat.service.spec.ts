import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ChatService, ChatMessage } from './chat.service';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { OfflineQueueService } from './offline-queue.service';
import { HapticFeedbackService } from './haptic-feedback.service';
import { ChatCacheService } from './chat-cache.service';
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
          provide: HapticFeedbackService,
          useValue: { tap: hapticTapMock } as unknown as HapticFeedbackService,
        },
        {
          provide: ChatCacheService,
          useValue: {
            getCachedMessages: vi.fn().mockReturnValue(Promise.resolve(null)),
            getCachedRooms: vi.fn().mockReturnValue(Promise.resolve(null)),
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
      ],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    it('should add a label and update local state', async () => {
      const getReq = service.getLabels();
      httpMock.expectOne(`${baseUrl}/labels`).flush(['existing']);
      await getReq;

      const addPromise = service.addLabel('new-label');
      const req = httpMock.expectOne(`${baseUrl}/labels`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ label: 'new-label' });
      req.flush({});

      await addPromise;
    });

    it('should remove a label with an encoded URL', async () => {
      const promise = service.removeLabel('a/b');
      const req = httpMock.expectOne(`${baseUrl}/labels/${encodeURIComponent('a/b')}`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should assign a label to a room', async () => {
      const promise = service.assignLabelToRoom('room-1', 'urgent');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/labels`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ label: 'urgent' });
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
    });

    it('should remove a label from a room', async () => {
      const promise = service.removeLabelFromRoom('room-1', 'urgent');
      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/labels/urgent`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      await expect(promise).resolves.toBeUndefined();
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

    it('should reject sending to a blocked receiver', async () => {
      currentUser.set({ id: 'user-1' });
      getBlockedAndBlockerIdsMock.mockResolvedValue(['user-2']);

      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      const membersReq = httpMock.expectOne(`${baseUrl}/rooms/room-1/members`);
      membersReq.flush([{ user_id: 'user-1' }, { user_id: 'user-2' }]);

      await expect(promise).rejects.toThrow('You cannot send messages to this user.');
    });

    it('should attempt delivery when navigator reports offline but the API is reachable', async () => {
      currentUser.set({ id: 'user-1' });
      vi.stubGlobal('navigator', { onLine: false });

      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      httpMock.expectOne(`${baseUrl}/rooms/room-1/members`).flush([]);
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
      httpMock.expectOne(`${baseUrl}/messages`).flush(sentMessage);

      await expect(promise).resolves.toEqual(sentMessage);
      expect(enqueueMessageMock).not.toHaveBeenCalled();
    });

    it('should queue the message after a transport failure', async () => {
      currentUser.set({ id: 'user-1' });

      const promise = service.sendMessage({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'hi',
      });

      httpMock.expectOne(`${baseUrl}/rooms/room-1/members`).flush([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      httpMock.expectOne(`${baseUrl}/messages`).error(new ProgressEvent('error'));

      const queued = await promise;
      expect(queued.room_id).toBe('room-1');
      expect(queued.text_content).toBe('hi');
      expect(enqueueMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ room_id: 'room-1' }),
      );
      expect(hapticTapMock).toHaveBeenCalled();

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

    it('requests locked metadata explicitly without reading or polluting the inbox cache', async () => {
      const cache = TestBed.inject(ChatCacheService);
      const promise = service.getRooms({ includeLocked: true });

      await new Promise((resolve) => setTimeout(resolve, 0));

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/rooms` && request.params.get('include_locked') === 'true',
      );
      req.flush([
        {
          id: 'locked-room',
          title: 'Locked',
          subtitle: '',
          avatar: '',
          is_online: false,
          is_pinned: false,
          is_locked: true,
          created_at: 'now',
        },
      ]);

      await expect(promise).resolves.toHaveLength(1);
      expect(cache.getCachedRooms).not.toHaveBeenCalled();
      expect(cache.cacheRooms).not.toHaveBeenCalled();
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

  describe('favourites and reporting (fetch based)', () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should add a favourite', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await service.addFavourite('msg-1', 'a note');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/favourites`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message_id: 'msg-1', note_text: 'a note' }),
        }),
      );
    });

    it('should throw when adding a favourite fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(service.addFavourite('msg-1')).rejects.toThrow('Failed to add favourite');
    });

    it('should fetch favourites over HTTP', async () => {
      const promise = service.getFavourites();

      // Allow cache-check microtask to settle
      await new Promise((r) => setTimeout(r, 0));

      const req = httpMock.expectOne(`${baseUrl}/favourites`);
      req.flush([]);

      await expect(promise).resolves.toEqual([]);
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

  describe('room history (network-first)', () => {
    let cache: {
      getCachedMessages: ReturnType<typeof vi.fn>;
      cacheMessages: ReturnType<typeof vi.fn>;
    };

    function message(id: string, senderId = 'partner-1'): ChatMessage {
      return {
        id,
        room_id: 'room-1',
        sender_id: senderId,
        message_type: 'text',
        text_content: id,
        is_read: false,
        created_at: '2026-09-26T10:00:00.000Z',
      };
    }

    beforeEach(() => {
      cache = TestBed.inject(ChatCacheService) as unknown as typeof cache;
    });

    it('always asks the server for the newest window and warms the room cache', async () => {
      cache.getCachedMessages.mockResolvedValue([message('stale')]);

      const promise = service.getLatestMessages('room-1');

      const req = httpMock.expectOne(`${baseUrl}/messages/room-1`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([message('fresh')]);

      await expect(promise).resolves.toEqual([message('fresh')]);
      expect(cache.getCachedMessages).not.toHaveBeenCalled();
      expect(cache.cacheMessages).toHaveBeenCalledWith('room-1', [message('fresh')]);
    });

    it('pages older history with the cursor and never caches the partial view', async () => {
      const promise = service.getLatestMessages('room-1', {
        before: '2026-09-26T09:00:00.000000+00:00',
        limit: 50,
      });

      const req = httpMock.expectOne((request) => request.url === `${baseUrl}/messages/room-1`);
      expect(req.request.params.get('before')).toBe('2026-09-26T09:00:00.000000+00:00');
      expect(req.request.params.get('limit')).toBe('50');
      req.flush([message('older')]);

      await expect(promise).resolves.toEqual([message('older')]);
      expect(cache.cacheMessages).not.toHaveBeenCalled();
    });

    it('filters blocked senders from network results', async () => {
      getBlockedAndBlockerIdsMock.mockResolvedValue(['blocked-1']);

      const promise = service.getLatestMessages('room-1');
      httpMock
        .expectOne(`${baseUrl}/messages/room-1`)
        .flush([message('ok'), message('hidden', 'blocked-1')]);

      await expect(promise).resolves.toEqual([message('ok')]);
    });

    it.each([
      ['a network failure', 0],
      ['a server fault', 503],
    ])(
      'falls back to the cached snapshot after %s so the room stays readable offline',
      async (_label, status) => {
        cache.getCachedMessages.mockResolvedValue([
          message('cached'),
          message('hidden', 'blocked-1'),
        ]);
        getBlockedAndBlockerIdsMock.mockResolvedValue(['blocked-1']);

        const promise = service.getLatestMessages('room-1');
        httpMock
          .expectOne(`${baseUrl}/messages/room-1`)
          .error(new ProgressEvent('error'), { status, statusText: 'unavailable' });

        await expect(promise).resolves.toEqual([message('cached')]);
      },
    );

    it('rethrows when the network fails and nothing is cached', async () => {
      cache.getCachedMessages.mockResolvedValue(null);

      const promise = service.getLatestMessages('room-1');
      httpMock
        .expectOne(`${baseUrl}/messages/room-1`)
        .flush('down', { status: 503, statusText: 'Service Unavailable' });

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
    });

    it('never falls back to cached content after an authorisation refusal', async () => {
      cache.getCachedMessages.mockResolvedValue([message('cached')]);

      const promise = service.getLatestMessages('room-1');
      httpMock
        .expectOne(`${baseUrl}/messages/room-1`)
        .flush({ message: 'Not a member of this room' }, { status: 403, statusText: 'Forbidden' });

      await expect(promise).rejects.toMatchObject({ status: 403 });
      expect(cache.getCachedMessages).not.toHaveBeenCalled();
    });

    it('surfaces a failure while paging older history instead of falling back', async () => {
      cache.getCachedMessages.mockResolvedValue([message('cached')]);

      const promise = service.getLatestMessages('room-1', { before: '2026-09-26T09:00:00Z' });
      httpMock
        .expectOne((request) => request.url === `${baseUrl}/messages/room-1`)
        .flush('down', { status: 503, statusText: 'Service Unavailable' });

      await expect(promise).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(cache.getCachedMessages).not.toHaveBeenCalled();
    });

    it('returns nothing without an access token', async () => {
      getAccessTokenMock.mockReturnValue(null);

      await expect(service.getLatestMessages('room-1')).resolves.toEqual([]);
      httpMock.expectNone(`${baseUrl}/messages/room-1`);
    });
  });

  describe('read receipts', () => {
    it('acknowledges messages with one bulk POST scoped to the room', async () => {
      const promise = service.markRoomRead('room-1', ['m1', 'm2']);

      const req = httpMock.expectOne(`${baseUrl}/rooms/room-1/read`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(req.request.body).toEqual({ message_ids: ['m1', 'm2'] });
      req.flush({ success: true, marked: 2 });

      await expect(promise).resolves.toBeUndefined();
    });

    it('sends nothing when there is nothing to acknowledge', async () => {
      await service.markRoomRead('room-1', []);

      httpMock.expectNone(`${baseUrl}/rooms/room-1/read`);
    });

    it('splits very large acknowledgements into API-sized sequential batches', async () => {
      const ids = Array.from({ length: 230 }, (_, index) => `m${index}`);
      const promise = service.markRoomRead('room-1', ids);
      const sizes: number[] = [];

      for (let batch = 0; batch < 3; batch++) {
        const req = await vi.waitFor(() => httpMock.expectOne(`${baseUrl}/rooms/room-1/read`));
        const size: number = req.request.body.message_ids.length;
        sizes.push(size);
        req.flush({ success: true, marked: size });
      }

      await expect(promise).resolves.toBeUndefined();
      expect(sizes).toEqual([100, 100, 30]);
    });

    it('loads who read a message with authentication and an encoded id', async () => {
      const receipts = { readBy: [], totalMembers: 3 };
      const promise = service.getMessageReceipts('msg/1');

      const req = httpMock.expectOne(`${baseUrl}/messages/msg%2F1/receipts`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(receipts);

      await expect(promise).resolves.toEqual(receipts);
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
