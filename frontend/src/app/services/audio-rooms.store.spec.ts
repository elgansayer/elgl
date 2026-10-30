import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Participant, RoomEvent, Track } from 'livekit-client';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomsStore, AudioRoomRecord } from './audio-rooms.store';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { EconomyStore } from './economy.store';
import { I18nService } from './i18n.service';

const {
  roomOn,
  roomOff,
  roomConnect,
  roomDisconnect,
  setMicrophoneEnabled,
  getTrackPublication,
  roomConstructed,
  roomEventHandlers,
} = vi.hoisted(() => ({
  roomOn: vi.fn(),
  roomOff: vi.fn(),
  roomConnect: vi.fn().mockResolvedValue(undefined),
  roomDisconnect: vi.fn().mockResolvedValue(undefined),
  setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  getTrackPublication: vi.fn().mockReturnValue({ isMuted: true }),
  roomConstructed: vi.fn(),
  roomEventHandlers: new Map<string, (...args: unknown[]) => void>(),
}));

vi.mock('livekit-client', () => {
  class RemoteVideoTrackMock {}

  return {
    createLocalVideoTrack: async () => ({}),
    RemoteVideoTrack: RemoteVideoTrackMock,
    RoomEvent: {
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      TrackMuted: 'trackMuted',
      TrackUnmuted: 'trackUnmuted',
      ActiveSpeakersChanged: 'activeSpeakersChanged',
    },
    Track: {
      Kind: { Video: 'video' },
      Source: { Microphone: 'microphone' },
    },
    Room: function RoomMock() {
      roomConstructed();
      return {
        on: roomOn,
        off: roomOff,
        connect: roomConnect,
        disconnect: roomDisconnect,
        remoteParticipants: new Map(),
        localParticipant: {
          identity: 'Speaker_user-1',
          isSpeaking: false,
          getTrackPublication,
          setMicrophoneEnabled,
        },
      };
    },
  };
});

describe('AudioRoomsStore LiveKit stage state', () => {
  let store: AudioRoomsStore;
  let http: HttpTestingController;
  let roomEventCallback: ((event: unknown) => void) | null;

  const room: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'language-room',
    title: 'Language room',
    target_language: 'en',
    host_id: 'host-1',
    is_active: true,
    speakers: ['host-1'],
    raised_hands: ['user-1'],
    listeners_count: 1,
    created_at: '2026-10-29T00:00:00Z',
  };

  beforeEach(() => {
    roomEventHandlers.clear();
    roomOn
      .mockReset()
      .mockImplementation((event: RoomEvent, handler: (...args: unknown[]) => void) => {
        roomEventHandlers.set(event, handler);
        return { on: roomOn };
      });
    roomOff.mockReset();
    roomConnect.mockClear();
    roomDisconnect.mockClear();
    setMicrophoneEnabled.mockClear();
    getTrackPublication.mockClear();
    roomConstructed.mockClear();
    roomEventCallback = null;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AudioRoomsStore,
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 'user-1' }),
            getAccessToken: () => 'access-token',
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockImplementation((_channel: string, callback: (event: unknown) => void) => {
              roomEventCallback = callback;
              return {};
            }),
            unsubscribe: vi.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
        {
          provide: EconomyStore,
          useValue: { triggerPublicGiftAnimation: vi.fn() },
        },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: () => false,
            isCentrifugoDegraded: () => false,
            isSupabaseDegraded: () => false,
            isFullyOperational: () => true,
            degradationSummary: () => '',
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(AudioRoomsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reconnects with a refreshed publisher token when the listener is approved', async () => {
    const joinPromise = store.joinRoom(room);
    http.expectOne((request) => request.url.endsWith('/audio-rooms/room-1/stage')).flush({
      room_id: 'room-1',
      room_name: 'language-room',
      host: null,
      co_host_id: null,
      speakers: [],
      raised_hands: ['user-1'],
      listeners_count: 1,
    });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/token')).flush({
      token: 'listener-token',
      room_id: 'room-1',
      room_name: 'language-room',
      livekit_url: 'wss://livekit.example',
      is_speaker: false,
    });
    await joinPromise;

    roomEventCallback?.({ type: 'speaker_approved', target_user_id: 'user-1' });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/room-1/stage')).flush({
      room_id: 'room-1',
      room_name: 'language-room',
      host: null,
      co_host_id: null,
      speakers: [
        {
          user_id: 'user-1',
          display_name: 'Approved speaker',
          avatar_url: null,
        },
      ],
      raised_hands: [],
      listeners_count: 1,
    });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/token')).flush({
      token: 'speaker-token',
      livekit_url: 'wss://mock-named-livekit.example',
      is_speaker: true,
    });
    await vi.waitFor(() => expect(setMicrophoneEnabled).toHaveBeenCalledWith(true));

    expect(roomDisconnect).toHaveBeenCalledOnce();
    expect(roomConnect).toHaveBeenLastCalledWith(
      'wss://mock-named-livekit.example',
      'speaker-token',
    );
    expect(store.isSpeaker()).toBe(true);
    expect(store.stageParticipants().map((participant) => participant.user_id)).toEqual([
      'user-1',
    ]);
  });

  it('removes a demoted speaker from the rendered stage snapshot', async () => {
    const joinedRoom = {
      ...room,
      speakers: ['host-1', 'user-1'],
      raised_hands: [],
    };
    const joinPromise = store.joinRoom(joinedRoom);
    http.expectOne((request) => request.url.endsWith('/audio-rooms/room-1/stage')).flush({
      room_id: 'room-1',
      room_name: 'language-room',
      host: null,
      co_host_id: null,
      speakers: [
        {
          user_id: 'user-1',
          display_name: 'Speaker',
          avatar_url: null,
        },
      ],
      raised_hands: [],
      listeners_count: 1,
    });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/token')).flush({
      token: 'speaker-token',
      room_id: 'room-1',
      room_name: 'language-room',
      livekit_url: 'wss://livekit.example',
      is_speaker: true,
    });
    await joinPromise;

    roomEventCallback?.({ type: 'speaker_demoted', target_user_id: 'user-1' });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/room-1/stage')).flush({
      room_id: 'room-1',
      room_name: 'language-room',
      host: null,
      co_host_id: null,
      speakers: [],
      raised_hands: [],
      listeners_count: 2,
    });

    expect(store.currentRoom()?.speakers).toEqual(['host-1']);
    await vi.waitFor(() => expect(store.stageParticipants()).toEqual([]));
    expect(store.isSpeaker()).toBe(false);
    expect(setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it('projects LiveKit microphone and active-speaker events into the stage grid', () => {
    store.stageParticipants.set([
      {
        user_id: 'user-1',
        display_name: 'Speaker',
        avatar_url: null,
        isSpeaking: false,
        isMuted: true,
        isHost: false,
        isCoHost: false,
      },
    ]);
    const internals = store as unknown as {
      onTrackUnmuted: (publication: { source: Track.Source }, participant: Participant) => void;
      onTrackMuted: (publication: { source: Track.Source }, participant: Participant) => void;
      onActiveSpeakersChanged: (participants: Participant[]) => void;
    };
    const participant = { identity: 'Speaker_user-1' } as Participant;
    const microphone = { source: Track.Source.Microphone };

    internals.onTrackUnmuted(microphone, participant);
    internals.onActiveSpeakersChanged([participant]);
    expect(store.stageParticipants()[0]).toMatchObject({ isMuted: false, isSpeaking: true });

    internals.onTrackMuted(microphone, participant);
    internals.onActiveSpeakersChanged([]);
    expect(store.stageParticipants()[0]).toMatchObject({ isMuted: true, isSpeaking: false });
  });

  it('registers all stage-state listeners on the LiveKit room', async () => {
    const joinPromise = store.joinRoom(room);
    http.expectOne((request) => request.url.endsWith('/audio-rooms/room-1/stage')).flush({
      room_id: 'room-1',
      room_name: 'language-room',
      host: null,
      co_host_id: null,
      speakers: [],
      raised_hands: [],
      listeners_count: 1,
    });
    http.expectOne((request) => request.url.endsWith('/audio-rooms/token')).flush({
      token: 'listener-token',
      livekit_url: 'wss://livekit.example',
      is_speaker: false,
    });
    await joinPromise;

    expect(roomEventHandlers.has(RoomEvent.TrackMuted)).toBe(true);
    expect(roomEventHandlers.has(RoomEvent.TrackUnmuted)).toBe(true);
    expect(roomEventHandlers.has(RoomEvent.ActiveSpeakersChanged)).toBe(true);
    expect(roomConstructed).toHaveBeenCalledOnce();
  });
});
