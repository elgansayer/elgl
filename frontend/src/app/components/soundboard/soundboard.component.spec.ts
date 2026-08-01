import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { SoundboardComponent, SoundItem } from './soundboard.component';
import { SoundboardService } from '../../services/soundboard.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { I18nService } from '../../services/i18n.service';

class MockAudio {
  volume = 0;
  src: string;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  addEventListener = vi.fn();
  constructor(src: string) {
    this.src = src;
    audioInstances.push(this);
  }
}

let audioInstances: MockAudio[] = [];

describe('SoundboardComponent', () => {
  let component: SoundboardComponent;
  let fixture: ComponentFixture<SoundboardComponent>;
  let getSoundsMock: ReturnType<typeof vi.fn>;
  let playSoundMock: ReturnType<typeof vi.fn>;
  let subscribeCalls: Array<{ channel: string; cb: (data: unknown) => void }>;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;

  let soundboardService: SoundboardService;
  let centrifugoService: CentrifugoService;
  let authService: AuthService;
  let hapticFeedback: HapticFeedbackService;
  let i18nService: I18nService;

  beforeEach(() => {
    audioInstances = [];
    vi.stubGlobal('Audio', MockAudio);

    subscribeCalls = [];
    currentUser = signal<{ id: string } | null>(null);

    getSoundsMock = vi.fn();
    playSoundMock = vi.fn().mockResolvedValue(undefined);

    soundboardService = {
      getSounds: getSoundsMock,
      playSound: playSoundMock,
    } as unknown as SoundboardService;

    centrifugoService = {
      subscribe: vi.fn((channel: string, cb: (data: unknown) => void) => {
        subscribeCalls.push({ channel, cb });
      }),
    } as unknown as CentrifugoService;

    authService = {
      currentUser,
    } as unknown as AuthService;

    hapticFeedback = {
      tap: vi.fn(),
    } as unknown as HapticFeedbackService;

    i18nService = {
      translate: vi.fn((key: string) => key),
    } as unknown as I18nService;

    TestBed.configureTestingModule({
      imports: [SoundboardComponent],
      providers: [
        { provide: SoundboardService, useValue: soundboardService },
        { provide: CentrifugoService, useValue: centrifugoService },
        { provide: AuthService, useValue: authService },
        { provide: HapticFeedbackService, useValue: hapticFeedback },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SoundboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    subscribeCalls = [];
    audioInstances = [];
  });

  it('should create the component', () => {
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should allow the host user to play sounds', () => {
    currentUser.set({ id: 'host-1' });
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();

    expect(component.canPlay()).toBe(true);
  });

  it('should forbid a non-host user from playing sounds', () => {
    currentUser.set({ id: 'guest-9' });
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();

    expect(component.canPlay()).toBe(false);
  });

  it('should load sound items from the backend service', fakeAsync(() => {
    const mockSounds: SoundItem[] = [
      { id: 's1', name: 'Laugh', url: 'https://example.com/laugh.mp3', icon: '😂' },
      { id: 's2', name: 'Cheer', url: 'https://example.com/cheer.mp3', icon: '🎉' },
    ];
    getSoundsMock.mockResolvedValue({ sounds: mockSounds });

    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();
    tick();

    expect(component.sounds()).toEqual(mockSounds);
  }));

  it('should call backend playSound and haptic feedback when the host taps a sound', fakeAsync(() => {
    currentUser.set({ id: 'host-1' });
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();

    const sound: SoundItem = {
      id: 's1',
      name: 'Laugh',
      url: 'https://example.com/laugh.mp3',
      icon: '😂',
    };

    component.playSound(sound);
    tick();

    expect(playSoundMock).toHaveBeenCalledWith('room-1', 's1');
    expect((hapticFeedback as unknown as { tap: ReturnType<typeof vi.fn> }).tap).toHaveBeenCalled();
  }));

  it('should NOT call backend or haptic feedback when a non-host taps a sound', fakeAsync(() => {
    currentUser.set({ id: 'guest-9' });
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();

    const sound: SoundItem = {
      id: 's1',
      name: 'Laugh',
      url: 'https://example.com/laugh.mp3',
      icon: '😂',
    };

    component.playSound(sound);
    tick();

    expect(playSoundMock).not.toHaveBeenCalled();
    expect((hapticFeedback as unknown as { tap: ReturnType<typeof vi.fn> }).tap).not.toHaveBeenCalled();
  }));

  it('should play a remote sound when a soundboard_play Centrifugo event arrives', fakeAsync(() => {
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostUserId', 'host-1');
    fixture.detectChanges();
    tick();

    const channel = 'room_room-1';
    const subscription = subscribeCalls.find((c) => c.channel === channel);
    expect(subscription).toBeDefined();

    const soundUrl = 'https://example.com/remote.mp3';
    subscription?.cb({ type: 'soundboard_play', sound_url: soundUrl });
    tick();

    // The component creates a new Audio element and sets volume to 0.6.
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe(soundUrl);
    expect(audioInstances[0].volume).toBe(0.6);
    expect(audioInstances[0].play).toHaveBeenCalled();
  }));
});
