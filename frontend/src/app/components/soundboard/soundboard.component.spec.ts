import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoundboardComponent } from './soundboard.component';
import { SoundboardService } from '../../services/soundboard.service';
import { CentrifugoService, CentrifugoEvent } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

interface UserInfo {
  id: string;
}

interface AudioStubRecord {
  src: string;
  volume: number;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
}

describe('SoundboardComponent', () => {
  let component: SoundboardComponent;
  let fixture: ComponentFixture<SoundboardComponent>;
  let getSoundsMock: ReturnType<typeof vi.fn>;
  let playSoundMock: ReturnType<typeof vi.fn>;
  let hapticTapFn: ReturnType<typeof vi.fn>;
  let currentUserSignal: ReturnType<typeof signal<UserInfo | null>>;
  let eventsSignal: ReturnType<typeof signal<CentrifugoEvent[]>>;
  const audioElements: AudioStubRecord[] = [];

  beforeEach(async () => {
    audioElements.length = 0;

    class AudioStub {
      volume = 0;
      readonly src: string;
      readonly play = vi.fn().mockResolvedValue(undefined);
      readonly pause = vi.fn();
      readonly addEventListener = vi.fn();

      constructor(src: string) {
        this.src = src;
        audioElements.push(this);
      }
    }
    vi.stubGlobal('Audio', AudioStub);

    getSoundsMock = vi.fn().mockResolvedValue({
      sounds: [{ id: 'applause', name: 'Applause', icon: '👏' }],
    });
    playSoundMock = vi.fn().mockResolvedValue({ success: true });
    hapticTapFn = vi.fn();
    currentUserSignal = signal<UserInfo | null>(null);
    eventsSignal = signal<CentrifugoEvent[]>([]);

    await TestBed.configureTestingModule({
      imports: [SoundboardComponent],
      providers: [
        {
          provide: SoundboardService,
          useValue: { getSounds: getSoundsMock, playSound: playSoundMock },
        },
        { provide: CentrifugoService, useValue: { events: eventsSignal } },
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

  async function initialise(
    roomId = 'room-1',
    hostUserId = 'host-1',
    coHostUserId = 'cohost-1',
  ): Promise<void> {
    fixture.componentRef.setInput('roomId', roomId);
    fixture.componentRef.setInput('hostUserId', hostUserId);
    fixture.componentRef.setInput('coHostUserId', coHostUserId);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('allows the host and co-host to operate the board but not listeners', async () => {
    currentUserSignal.set({ id: 'host-1' });
    await initialise();
    expect(component.canPlay()).toBe(true);

    currentUserSignal.set({ id: 'cohost-1' });
    fixture.detectChanges();
    expect(component.canPlay()).toBe(true);

    currentUserSignal.set({ id: 'listener-1' });
    fixture.detectChanges();
    expect(component.canPlay()).toBe(false);
  });

  it('loads the server-authoritative sound catalogue for an active room', async () => {
    currentUserSignal.set({ id: 'host-1' });
    await initialise();

    expect(getSoundsMock).toHaveBeenCalledTimes(1);
    expect(component.sounds()).toEqual([
      { id: 'applause', name: 'Applause', icon: '👏' },
    ]);
    expect(component.loadError()).toBe(false);
  });

  it('exposes retryable catalogue failures', async () => {
    getSoundsMock.mockRejectedValueOnce(new Error('offline'));
    currentUserSignal.set({ id: 'host-1' });
    await initialise();
    expect(component.loadError()).toBe(true);

    getSoundsMock.mockResolvedValueOnce({
      sounds: [{ id: 'gong', name: 'Gong', icon: '🔔' }],
    });
    component.retryLoad();
    await fixture.whenStable();

    expect(component.loadError()).toBe(false);
    expect(component.sounds()[0]?.id).toBe('gong');
  });

  it('serializes play mutations and gives haptic feedback only to authorized users', async () => {
    let resolvePlay: (() => void) | undefined;
    playSoundMock.mockReturnValueOnce(
      new Promise<{ success: true }>((resolve) => {
        resolvePlay = () => resolve({ success: true });
      }),
    );
    currentUserSignal.set({ id: 'host-1' });
    await initialise();
    const sound = component.sounds()[0]!;

    const first = component.playSound(sound);
    void component.playSound(sound);
    expect(playSoundMock).toHaveBeenCalledTimes(1);
    expect(hapticTapFn).toHaveBeenCalledTimes(1);
    expect(component.playingSoundId()).toBe('applause');

    resolvePlay?.();
    await first;
    expect(component.playingSoundId()).toBeNull();
  });

  it('keeps failed play mutations retryable without fabricating local playback', async () => {
    playSoundMock.mockRejectedValueOnce(new Error('unavailable'));
    currentUserSignal.set({ id: 'host-1' });
    await initialise();

    await component.playSound(component.sounds()[0]!);

    expect(component.playError()).toBe(true);
    expect(component.playingSoundId()).toBeNull();
    expect(audioElements).toHaveLength(0);
  });

  it('plays only bundled audio for a validated room event and ignores supplied URLs', async () => {
    currentUserSignal.set({ id: 'listener-1' });
    await initialise();

    eventsSignal.set([
      {
        channel: 'room_room-1',
        data: {
          type: 'soundboard_play',
          sound_id: 'applause',
          sound_url: 'https://attacker.example/arbitrary.mp3',
        },
      },
    ]);
    fixture.detectChanges();

    expect(audioElements).toHaveLength(1);
    expect(audioElements[0]?.src.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(audioElements[0]?.src).not.toContain('attacker.example');
    expect(audioElements[0]?.volume).toBe(0.6);
    expect(audioElements[0]?.play).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown sounds and events from another room', async () => {
    await initialise();

    eventsSignal.set([
      { channel: 'room_room-2', data: { type: 'soundboard_play', sound_id: 'applause' } },
    ]);
    fixture.detectChanges();
    eventsSignal.set([
      ...eventsSignal(),
      { channel: 'room_room-1', data: { type: 'soundboard_play', sound_id: 'custom-url' } },
    ]);
    fixture.detectChanges();

    expect(audioElements).toHaveLength(0);
  });
});
