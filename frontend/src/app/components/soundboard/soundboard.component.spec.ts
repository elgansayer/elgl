import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { SoundboardComponent, SoundItem } from './soundboard.component';
import { SoundboardService } from '../../services/soundboard.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

interface UserInfo { id: string }

describe('SoundboardComponent', () => {
  let component: SoundboardComponent;
  let fixture: ComponentFixture<SoundboardComponent>;
  let getSoundsMock: ReturnType<typeof vi.fn>;
  let playSoundMock: ReturnType<typeof vi.fn>;
  let subscribeFn: ReturnType<typeof vi.fn>;
  let hapticTapFn: ReturnType<typeof vi.fn>;
  let currentUserSignal: () => UserInfo | null;

  const audioElements: Array<{ src: string; volume: number; play: ReturnType<typeof vi.fn> }> = [];

  beforeEach(async () => {
    audioElements.length = 0;

    class AudioStub {
      volume = 0;
      src = '';
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      addEventListener = vi.fn();
      constructor(src: string) {
        this.src = src;
        audioElements.push(this);
      }
    }
    vi.stubGlobal('Audio', AudioStub);

    getSoundsMock = vi.fn().mockResolvedValue({ sounds: [] });
    playSoundMock = vi.fn().mockResolvedValue(undefined);
    subscribeFn = vi.fn();
    hapticTapFn = vi.fn();
    currentUserSignal = signal<UserInfo | null>(null);

    await TestBed.configureTestingModule({
      imports: [SoundboardComponent],
      providers: [
        { provide: SoundboardService, useValue: { getSounds: getSoundsMock, playSound: playSoundMock } },
        { provide: CentrifugoService, useValue: { subscribe: subscribeFn } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: HapticFeedbackService, useValue: { tap: hapticTapFn } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SoundboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setInputsAndInit(roomId: string, hostUserId: string): void {
    fixture.componentRef.setInput('roomId', roomId);
    fixture.componentRef.setInput('hostUserId', hostUserId);
    fixture.detectChanges();
  }

  it('should create the component', () => {
    setInputsAndInit('room-1', 'host-1');
    expect(component).toBeTruthy();
  });

  it('should allow the host user to play sounds', () => {
    (currentUserSignal as ReturnType<typeof signal<UserInfo | null>>).set({ id: 'host-1' });
    setInputsAndInit('room-1', 'host-1');
    expect(component.canPlay()).toBe(true);
  });

  it('should forbid a non-host user from playing sounds', () => {
    (currentUserSignal as ReturnType<typeof signal<UserInfo | null>>).set({ id: 'guest-9' });
    setInputsAndInit('room-1', 'host-1');
    expect(component.canPlay()).toBe(false);
  });

  it('should load sound items from the backend service', async () => {
    const mockSounds: SoundItem[] = [
      { id: 's1', name: 'Laugh', url: 'https://example.com/laugh.mp3', icon: '😂' },
    ];
    getSoundsMock.mockResolvedValue({ sounds: mockSounds });

    setInputsAndInit('room-1', 'host-1');
    // Wait for the async loadSounds triggered by the effect
    await fixture.whenStable();
    // Allow pending microtasks to flush
    await new Promise((r) => setTimeout(r, 10));

    expect(getSoundsMock).toHaveBeenCalled();
    expect(component.sounds()).toEqual(mockSounds);
  });

  it('should call backend playSound when the host taps a sound', async () => {
    (currentUserSignal as ReturnType<typeof signal<UserInfo | null>>).set({ id: 'host-1' });
    setInputsAndInit('room-1', 'host-1');

    const sound: SoundItem = { id: 's1', name: 'Laugh', url: 'https://example.com/laugh.mp3', icon: '😂' };
    await component.playSound(sound);

    expect(playSoundMock).toHaveBeenCalledWith('room-1', 's1');
    expect(hapticTapFn).toHaveBeenCalled();
  });

  it('should NOT call backend playSound when a non-host taps a sound', async () => {
    (currentUserSignal as ReturnType<typeof signal<UserInfo | null>>).set({ id: 'guest-9' });
    setInputsAndInit('room-1', 'host-1');

    const sound: SoundItem = { id: 's1', name: 'Laugh', url: 'https://example.com/laugh.mp3', icon: '😂' };
    await component.playSound(sound);

    expect(playSoundMock).not.toHaveBeenCalled();
    expect(hapticTapFn).not.toHaveBeenCalled();
  });

  it('should play a remote sound when a soundboard_play Centrifugo event arrives', async () => {
    setInputsAndInit('room-1', 'host-1');
    await fixture.whenStable();

    expect(subscribeFn).toHaveBeenCalled();
    // Extract the callback from the first subscribe call
    const cbArgs = subscribeFn.mock.calls.find((c: unknown[]) => c[0] === 'room_room-1');
    expect(cbArgs).toBeDefined();

    const callback = cbArgs![1] as (data: unknown) => void;
    callback({ type: 'soundboard_play', sound_url: 'https://example.com/remote.mp3' });

    expect(audioElements.length).toBe(1);
    expect(audioElements[0].src).toBe('https://example.com/remote.mp3');
    expect(audioElements[0].volume).toBe(0.6);
    expect(audioElements[0].play).toHaveBeenCalled();
  });
});
