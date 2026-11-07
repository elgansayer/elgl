import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomRecord, AudioRoomsStore, StageInfo } from './audio-rooms.store';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { I18nService } from './i18n.service';
import { PollResult, QuickPollService } from './quick-poll.service';

describe('AudioRoomsStore quick polls', () => {
  const room: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'room-one',
    title: 'Spanish practice',
    target_language: 'es',
    host_id: 'host-1',
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 2,
    created_at: '2026-11-03T00:00:00.000Z',
  };
  const recoveredPoll: PollResult = {
    poll_id: 'poll-1',
    question: 'Next topic?',
    options: ['Travel', 'Food'],
    votes: [2, 1],
    totalVotes: 3,
    is_active: true,
    userVote: 0,
  };
  const stage: StageInfo = {
    room_id: 'room-1',
    room_name: 'room-one',
    host: { id: 'host-1', display_name: 'Host', avatar_url: null },
    co_host_id: null,
    speakers: [{ user_id: 'host-1', display_name: 'Host', avatar_url: null }],
    raised_hands: [],
    listeners_count: 2,
  };
  const getActivePoll = vi.fn();
  const connect = vi.fn().mockResolvedValue(undefined);
  const subscribe = vi.fn();
  const unsubscribe = vi.fn();
  let roomEvent: (data: unknown) => void;
  let store: AudioRoomsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    roomEvent = () => undefined;
    subscribe.mockImplementation((_channel: string, handler: (data: unknown) => void) => {
      roomEvent = handler;
      return null;
    });
    getActivePoll.mockResolvedValue(recoveredPoll);

    TestBed.configureTestingModule({
      providers: [
        AudioRoomsStore,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(() => of(stage)),
            post: vi.fn(() =>
              of({
                token: 'room-token',
                room_id: 'room-1',
                room_name: 'room-one',
                livekit_url: 'mock://livekit',
                is_speaker: false,
              }),
            ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'access-token',
            currentUser: signal({ id: 'listener-1' }),
          },
        },
        {
          provide: CentrifugeService,
          useValue: { connect, subscribe, unsubscribe },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: EconomyStore,
          useValue: { triggerPublicGiftAnimation: vi.fn(), coinsBalance: signal(0) },
        },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: signal(false),
            isCentrifugoDegraded: signal(false),
            isSupabaseDegraded: signal(false),
            isFullyOperational: signal(true),
            degradationSummary: signal(null),
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QuickPollService,
          useValue: { getActivePoll },
        },
      ],
    });

    store = TestBed.inject(AudioRoomsStore);
  });

  it('recovers the active poll after subscribing to the room channel', async () => {
    await store.joinRoom(room);

    expect(connect).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith('room_room-1', expect.any(Function));
    expect(getActivePoll).toHaveBeenCalledWith('room-1');
    expect(store.currentPoll()).toEqual(recoveredPoll);
  });

  it('applies realtime aggregates, preserves the caller vote, and clears on leave', async () => {
    getActivePoll.mockResolvedValue(null);
    await store.joinRoom(room);

    roomEvent({
      type: 'poll_opened',
      poll_id: 'poll-2',
      question: 'Choose one',
      options: ['Grammar', 'Speaking'],
    });
    const openedPoll = store.currentPoll();
    if (!openedPoll) throw new Error('Expected the opened poll');
    store.setCurrentPoll({ ...openedPoll, userVote: 1 });
    roomEvent({
      type: 'poll_updated',
      poll_id: 'poll-2',
      question: 'Choose one',
      options: ['Grammar', 'Speaking'],
      votes: [4, 2],
      totalVotes: 6,
      is_active: true,
    });

    expect(store.currentPoll()).toMatchObject({
      poll_id: 'poll-2',
      votes: [4, 2],
      totalVotes: 6,
      userVote: 1,
    });

    store.leaveRoom();

    expect(unsubscribe).toHaveBeenCalledWith('room_room-1');
    expect(store.currentPoll()).toBeNull();
  });
});
