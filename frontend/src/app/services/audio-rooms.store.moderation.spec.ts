import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { EconomyStore } from './economy.store';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomRecord, AudioRoomsStore, StageParticipant } from './audio-rooms.store';

describe('AudioRoomsStore host moderation', () => {
  let store: AudioRoomsStore;
  let httpTesting: HttpTestingController;

  const room = (overrides: Partial<AudioRoomRecord> = {}): AudioRoomRecord => ({
    id: 'room-1',
    room_name: 'language-room-1',
    title: 'Language room',
    target_language: 'ja',
    host_id: 'host-1',
    is_active: true,
    speakers: ['host-1', 'speaker-2'],
    raised_hands: [],
    listeners_count: 1,
    created_at: '2026-10-30T00:00:00.000Z',
    ...overrides,
  });

  const speaker = (overrides: Partial<StageParticipant> = {}): StageParticipant => ({
    user_id: 'speaker-2',
    display_name: 'Speaker Two',
    avatar_url: null,
    isSpeaking: true,
    isMuted: false,
    isHost: false,
    isCoHost: false,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: vi.fn().mockReturnValue('access-token'),
            currentUser: signal({ id: 'host-1' }),
          },
        },
        { provide: CentrifugeService, useValue: {} },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        {
          provide: EconomyStore,
          useValue: {
            coinsBalance: signal(0),
            triggerPublicGiftAnimation: vi.fn(),
          },
        },
        {
          provide: AudioRoomDegradationService,
          useValue: {
            isLiveKitDegraded: signal(false),
            isCentrifugoDegraded: signal(false),
            isSupabaseDegraded: signal(false),
            isFullyOperational: signal(true),
            degradationSummary: signal([]),
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
            refreshHealth: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(AudioRoomsStore);
    httpTesting = TestBed.inject(HttpTestingController);
    store.currentRoom.set(room());
    store.stageParticipants.set([speaker()]);
  });

  afterEach(() => httpTesting.verify());

  it('marks the target muted only after the API accepts the host action', async () => {
    const resultPromise = store.muteSpeaker('speaker-2');
    const request = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/mute-speaker`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      room_id: 'room-1',
      target_user_id: 'speaker-2',
    });
    request.flush(room());

    await expect(resultPromise).resolves.toBe(true);
    expect(store.stageParticipants()[0]?.isMuted).toBe(true);
  });

  it('preserves stage state and reports failure when muting is rejected', async () => {
    const resultPromise = store.muteSpeaker('speaker-2');
    const request = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/mute-speaker`);
    request.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    await expect(resultPromise).resolves.toBe(false);
    expect(store.stageParticipants()[0]?.isMuted).toBe(false);
  });

  it('removes the target from room and stage state after server confirmation', async () => {
    const resultPromise = store.demoteSpeaker('speaker-2');
    const request = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/demote-speaker`);

    expect(request.request.method).toBe('POST');
    request.flush(room({ speakers: ['host-1'] }));

    await expect(resultPromise).resolves.toBe(true);
    expect(store.currentRoom()?.speakers).toEqual(['host-1']);
    expect(store.stageParticipants()).toEqual([]);
  });

  it('does not issue a moderation request without an active room', async () => {
    store.currentRoom.set(null);

    await expect(store.muteSpeaker('speaker-2')).resolves.toBe(false);
    await expect(store.demoteSpeaker('speaker-2')).resolves.toBe(false);
    httpTesting.expectNone(`${environment.apiUrl}/audio-rooms/mute-speaker`);
    httpTesting.expectNone(`${environment.apiUrl}/audio-rooms/demote-speaker`);
  });
});
