import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { QuickPollService } from '../../services/quick-poll.service';
import { environment } from '../../../environments/environment';
import { AudioRoomComponent } from './audio-room.component';

describe('AudioRoomComponent API URLs and Stage Actions', () => {
  let component: AudioRoomComponent;
  let httpTesting: HttpTestingController;

  const currentUserSignal = signal<{ id: string; display_name: string } | null>({
    id: 'user-me',
    display_name: 'Me',
  });

  const currentRoomSignal = signal<{
    id: string;
    host_id: string;
    raised_hands: string[];
  } | null>({
    id: 'room-123',
    host_id: 'host-1',
    raised_hands: ['user-me', 'user-other'],
  });

  const store = {
    currentRoom: currentRoomSignal,
    stageInfo: signal(null),
    stageParticipants: signal([]),
    audienceCount: signal(0),
    selectedLanguageGroup: signal<string | null>(null),
    roomsByLanguage: signal([]),
    activeRooms: signal([]),
    isSpeaker: signal(false),
    loadActiveRooms: vi.fn().mockResolvedValue(undefined),
    loadRoomsByLanguage: vi.fn().mockResolvedValue(undefined),
    loadPrivateRooms: vi.fn().mockResolvedValue(undefined),
    raiseHand: vi.fn().mockResolvedValue(undefined),
    approveSpeaker: vi.fn().mockResolvedValue(undefined),
    dismissRaisedHand: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: store },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
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

  it('detects when the current user has raised their hand', () => {
    expect(component.hasRaisedHand()).toBe(true);

    currentRoomSignal.set({
      id: 'room-123',
      host_id: 'host-1',
      raised_hands: ['user-other'],
    });

    expect(component.hasRaisedHand()).toBe(false);
  });

  it('delegates raiseHand to store.raiseHand', async () => {
    await component.raiseHand();
    expect(store.raiseHand).toHaveBeenCalledTimes(1);
  });

  it('delegates handleApproveSpeaker to store.approveSpeaker', async () => {
    await component.handleApproveSpeaker('user-other');
    expect(store.approveSpeaker).toHaveBeenCalledWith('user-other');
  });

  it('delegates handleDeclineSpeaker to store.dismissRaisedHand', async () => {
    await component.handleDeclineSpeaker('user-other');
    expect(store.dismissRaisedHand).toHaveBeenCalledWith('user-other');
  });
});
