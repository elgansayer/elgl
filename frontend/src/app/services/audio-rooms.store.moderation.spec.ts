import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { EconomyStore } from './economy.store';
import { AudioRoomDegradationService } from './audio-room-degradation.service';
import { AudioRoomsStore, AudioRoomRecord } from './audio-rooms.store';

describe('AudioRoomsStore Host Moderation', () => {
  let store: AudioRoomsStore;
  let httpTesting: HttpTestingController;

  const mockRoom: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'test-room',
    title: 'English Chat',
    target_language: 'en',
    host_id: 'host-1',
    is_video_stream: false,
    is_active: true,
    speakers: ['host-1', 'user-2'],
    raised_hands: [],
    listeners_count: 5,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AudioRoomsStore,
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 'host-1', username: 'Host' }),
            getAccessToken: () => 'token-123',
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            subscribe: vi.fn(),
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
            startMonitoring: vi.fn(),
            stopMonitoring: vi.fn(),
          },
        },
      ],
    });

    store = TestBed.inject(AudioRoomsStore);
    httpTesting = TestBed.inject(HttpTestingController);
    store.currentRoom.set(mockRoom);
    store.stageParticipants.set([
      {
        user_id: 'host-1',
        display_name: 'Host User',
        avatar_url: null,
        isSpeaking: false,
        isMuted: false,
        isHost: true,
        isCoHost: false,
      },
      {
        user_id: 'user-2',
        display_name: 'Speaker 2',
        avatar_url: null,
        isSpeaking: false,
        isMuted: false,
        isHost: false,
        isCoHost: false,
      },
    ]);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('posts to mute-speaker endpoint', async () => {
    const promise = store.muteSpeaker('user-2');
    const req = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/mute-speaker`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      room_id: 'room-1',
      target_user_id: 'user-2',
    });
    req.flush(mockRoom);
    await promise;
  });

  it('does not expose a remote-unmute API call', () => {
    expect(Object.getOwnPropertyNames(AudioRoomsStore.prototype)).not.toContain('unmuteSpeaker');
  });

  it('posts to kick-speaker endpoint', async () => {
    const promise = store.kickSpeaker('user-2');
    const req = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/kick-speaker`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      room_id: 'room-1',
      target_user_id: 'user-2',
    });
    req.flush(mockRoom);
    await promise;
  });
});
