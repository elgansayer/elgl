import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AudioRoomsStore, StageParticipant } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { QuickPollService } from '../../services/quick-poll.service';
import { environment } from '../../../environments/environment';
import { AudioRoomComponent } from './audio-room.component';

describe('AudioRoomComponent API URLs', () => {
  let component: AudioRoomComponent;
  let httpTesting: HttpTestingController;

  const store = {
    currentRoom: signal({ id: 'room-123' }),
    stageInfo: signal(null),
    stageParticipants: signal<StageParticipant[]>([]),
    audienceCount: signal(0),
    selectedLanguageGroup: signal<string | null>(null),
    roomsByLanguage: signal([]),
    activeRooms: signal([]),
    loadActiveRooms: vi.fn().mockResolvedValue(undefined),
    loadRoomsByLanguage: vi.fn().mockResolvedValue(undefined),
    loadPrivateRooms: vi.fn().mockResolvedValue(undefined),
    setLocalMicrophoneMuted: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: store },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'user-1' }) },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: QuickPollService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AudioRoomComponent());
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads exclusive emojis through environment.apiUrl', async () => {
    const initPromise = component.ngOnInit();
    const url = `${environment.apiUrl}/audio-rooms/exclusive-emojis`;
    let request = httpTesting.match(url)[0];
    await vi.waitFor(() => {
      request ??= httpTesting.match(url)[0];
      expect(request).toBeDefined();
    });

    expect(request.request.method).toBe('GET');
    request.flush([]);

    await initPromise;
    expect(component.exclusiveEmojis()).toEqual([]);
  });

  it('sends exclusive reactions through environment.apiUrl', async () => {
    const reactionPromise = component.sendExclusiveReaction('heart');
    const request = httpTesting.expectOne(`${environment.apiUrl}/audio-rooms/room-123/reactions`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ emojiId: 'heart' });
    request.flush({ emojiId: 'heart', animationUrl: 'https://example.test/heart.json' });

    await reactionPromise;
  });

  it('toggles the current participant microphone locally', async () => {
    store.stageParticipants.set([
      {
        user_id: 'user-1',
        display_name: 'Speaker',
        avatar_url: null,
        isSpeaking: false,
        isMuted: false,
        isHost: false,
        isCoHost: false,
      },
    ]);

    await component.toggleMute();

    expect(store.setLocalMicrophoneMuted).toHaveBeenCalledWith(true);
  });
});
