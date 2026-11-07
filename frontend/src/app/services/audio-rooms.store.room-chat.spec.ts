import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SubscriptionState, type Subscription } from 'centrifuge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomRecord, AudioRoomsStore, RoomChatMessage } from './audio-rooms.store';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { I18nService } from './i18n.service';

describe('AudioRoomsStore room chat', () => {
  let store: AudioRoomsStore;
  let http: HttpTestingController;

  const room: AudioRoomRecord = {
    id: '4d72ae50-6153-4c54-a638-334fe24ab7e2',
    room_name: 'english-practice',
    title: 'English practice',
    target_language: 'en',
    host_id: 'user-1',
    is_active: true,
    speakers: ['user-1'],
    raised_hands: [],
    listeners_count: 1,
    created_at: '2026-11-03T09:00:00.000Z',
  };
  const message: RoomChatMessage = {
    id: 'd1a28d8e-81c4-4ea1-aaf2-f53bcedb1871',
    room_id: room.id,
    sender_id: 'user-1',
    sender_name: 'Alex',
    client_message_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    text_content: 'Hello room',
    created_at: '2026-11-03T10:00:00.000Z',
  };

  beforeEach(() => {
    const available = signal(false);
    TestBed.configureTestingModule({
      providers: [
        AudioRoomsStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'access-token',
            currentUser: signal({ id: 'user-1', email: 'alex@example.com' }),
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            publish: vi.fn(),
            connect: vi.fn(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
          },
        },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: EconomyStore, useValue: {} },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: available,
            isCentrifugoDegraded: available,
            isSupabaseDegraded: available,
            isFullyOperational: signal(true),
            degradationSummary: signal(''),
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn(),
          },
        },
      ],
    });
    store = TestBed.inject(AudioRoomsStore);
    http = TestBed.inject(HttpTestingController);
    store.currentRoom.set(room);
  });

  afterEach(() => http.verify());

  it('loads a bounded page through the authenticated audio-room API', async () => {
    const result = store.getRoomChatMessages(room.id, 25, 50);
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/audio-rooms/${room.id}/messages` &&
        candidate.params.get('limit') === '25' &&
        candidate.params.get('offset') === '50',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush({ messages: [message], limit: 25, offset: 50, has_more: false });

    await expect(result).resolves.toEqual({
      messages: [message],
      limit: 25,
      offset: 50,
      has_more: false,
    });
  });

  it('sends idempotently through the API and never publishes from the browser', async () => {
    const result = store.sendRoomChatMessage(
      `  ${message.text_content}  `,
      message.client_message_id,
    );
    const request = http.expectOne(`${environment.apiUrl}/audio-rooms/${room.id}/messages`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      client_message_id: message.client_message_id,
      text_content: message.text_content,
    });
    request.flush(message);

    await expect(result).resolves.toEqual(message);
    expect(store.roomMessages()).toEqual([message]);
    expect(TestBed.inject(CentrifugeService).publish).not.toHaveBeenCalled();
  });

  it('deduplicates the HTTP response and its realtime echo', () => {
    store.addRoomMessage(message);
    store.addRoomMessage(message);

    expect(store.roomMessages()).toEqual([message]);
  });

  it('drops a message that belongs to another room', () => {
    store.addRoomMessage({ ...message, room_id: '9b3a7f0c-0a4e-4b7a-8d5a-0c0c5d6f1e11' });

    expect(store.roomMessages()).toEqual([]);
  });

  it('does not surface a slow send response in a room joined afterwards', async () => {
    const result = store.sendRoomChatMessage(message.text_content, message.client_message_id);
    const request = http.expectOne(`${environment.apiUrl}/audio-rooms/${room.id}/messages`);

    store.currentRoom.set({ ...room, id: '9b3a7f0c-0a4e-4b7a-8d5a-0c0c5d6f1e11' });
    request.flush(message);
    await result;

    expect(store.roomMessages()).toEqual([]);
  });

  it('recovers messages published while realtime delivery was interrupted', async () => {
    const missed = {
      ...message,
      id: '0f9f2c3e-6a5b-4c1d-9e8f-7a6b5c4d3e2f',
      client_message_id: '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      text_content: 'Sent during the gap',
      created_at: '2026-11-03T10:05:00.000Z',
    };
    store.isConnectedToLiveKit.set(true);
    store.addRoomMessage(message);

    const recovery = store.recoverRoomChatMessages();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/audio-rooms/${room.id}/messages` &&
        candidate.params.get('limit') === '50' &&
        candidate.params.get('offset') === '0',
    );
    request.flush({ messages: [missed, message], limit: 50, offset: 0, has_more: false });
    await recovery;

    // The message already held is not duplicated and the newest comes last.
    expect(store.roomMessages()).toEqual([message, missed]);
  });

  it('skips recovery until the participant is connected to the live room', async () => {
    await store.recoverRoomChatMessages();

    store.isConnectedToLiveKit.set(true);
    store.currentRoom.set(null);
    await store.recoverRoomChatMessages();

    http.expectNone((candidate) => candidate.url.endsWith('/messages'));
  });

  it('clears private room-message state when the participant leaves', () => {
    store.addRoomMessage(message);
    store.roomChatRecoveryFailed.set(true);

    store.leaveRoom();

    expect(store.roomMessages()).toEqual([]);
    expect(store.roomChatRecoveryFailed()).toBe(false);
  });

  it('catches up once the server confirms the room subscription', async () => {
    let confirmSubscription: () => void = () => undefined;
    const once = vi.fn((_event: string, listener: () => void) => {
      confirmSubscription = listener;
    });
    await joinRoomWithRealtimeHandler({
      state: SubscriptionState.Subscribing,
      once,
    } as unknown as Subscription);

    expect(once).toHaveBeenCalledWith('subscribed', expect.any(Function));
    // The snapshot may predate the subscription, but nothing is read before it is live.
    http.expectNone((candidate) => candidate.url.endsWith('/messages'));

    confirmSubscription();
    http
      .expectOne((candidate) => candidate.url.endsWith(`/audio-rooms/${room.id}/messages`))
      .flush({ messages: [message], limit: 50, offset: 0, has_more: false });
    await vi.waitFor(() => expect(store.roomMessages()).toEqual([message]));
  });

  it('catches up straight away when the room subscription is already confirmed', async () => {
    await joinRoomWithRealtimeHandler({
      state: SubscriptionState.Subscribed,
      once: vi.fn(),
    } as unknown as Subscription);

    http
      .expectOne((candidate) => candidate.url.endsWith(`/audio-rooms/${room.id}/messages`))
      .flush({ messages: [message], limit: 50, offset: 0, has_more: false });
    await vi.waitFor(() => expect(store.roomMessages()).toEqual([message]));
  });

  it('reports a failed recovery through a signal and clears it after a successful retry', async () => {
    store.isConnectedToLiveKit.set(true);

    const failed = store.recoverRoomChatMessages();
    http
      .expectOne((candidate) => candidate.url.endsWith('/messages'))
      .flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    await expect(failed).resolves.toBeUndefined();
    expect(store.roomChatRecoveryFailed()).toBe(true);

    const retried = store.recoverRoomChatMessages();
    http
      .expectOne((candidate) => candidate.url.endsWith('/messages'))
      .flush({ messages: [message], limit: 50, offset: 0, has_more: false });
    await retried;
    expect(store.roomChatRecoveryFailed()).toBe(false);
    expect(store.roomMessages()).toEqual([message]);
  });

  it('accepts a persisted room chat payload from the realtime channel', async () => {
    const handler = await joinRoomWithRealtimeHandler();

    handler({ type: 'chat_message', message });

    expect(store.roomMessages()).toEqual([message]);
  });

  it('ignores a realtime room chat payload that is missing persisted fields', async () => {
    const handler = await joinRoomWithRealtimeHandler();

    handler({ type: 'chat_message', message: { id: 'partial', text_content: 'Hi' } });
    handler({ type: 'chat_message', message: { ...message, created_at: 42 } });

    expect(store.roomMessages()).toEqual([]);
  });

  async function joinRoomWithRealtimeHandler(
    subscription: Subscription | null = null,
  ): Promise<(data: unknown) => void> {
    let handler: ((data: unknown) => void) | null = null;
    const centrifuge = TestBed.inject(CentrifugeService);
    vi.mocked(centrifuge.subscribe).mockImplementation(
      (_channel: string, listener: (data: unknown) => void) => {
        handler = listener;
        return subscription;
      },
    );

    const joining = store.joinRoom(room);
    http.expectOne(`${environment.apiUrl}/audio-rooms/${room.id}/stage`).flush({
      room_id: room.id,
      room_name: room.room_name,
      host: { id: room.host_id, display_name: 'Host', avatar_url: null },
      co_host_id: null,
      speakers: [],
      raised_hands: [],
      listeners_count: 1,
    });
    http.expectOne(`${environment.apiUrl}/audio-rooms/token`).flush({
      token: 'mock-token',
      room_id: room.id,
      room_name: room.room_name,
      livekit_url: 'wss://mock.livekit.invalid',
      is_speaker: false,
      user_id: 'user-1',
    });
    await joining;

    if (!handler) {
      throw new Error('The realtime room handler was never registered.');
    }
    return handler;
  }
});
