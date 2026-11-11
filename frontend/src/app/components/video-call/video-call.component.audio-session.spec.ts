import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from 'livekit-client';
import { VideoCallComponent } from './video-call.component';
import { CallAudioSessionService } from '../../services/call-audio-session.service';
import { LivekitService } from '../../services/livekit.service';

describe('VideoCallComponent call audio session wiring', () => {
  let fixture: ComponentFixture<VideoCallComponent>;
  let component: VideoCallComponent;
  let audioSession: { attach: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> };
  let room: Room;
  let connect: ReturnType<typeof vi.spyOn>;
  let disconnect: ReturnType<typeof vi.spyOn>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    audioSession = { attach: vi.fn(), detach: vi.fn() };
    room = new Room();
    connect = vi.spyOn(room, 'connect').mockResolvedValue(undefined);
    disconnect = vi.spyOn(room, 'disconnect').mockResolvedValue(undefined);
    // jsdom has no media devices. An empty capture keeps the join flow running to the end.
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    await TestBed.configureTestingModule({
      imports: [VideoCallComponent],
      providers: [
        { provide: CallAudioSessionService, useValue: audioSession },
        {
          provide: LivekitService,
          useValue: {
            getToken: vi.fn().mockResolvedValue({ token: 'join-token', degraded: false }),
            getLiveKitUrl: vi.fn().mockReturnValue('wss://livekit.example.test'),
            createRoom: vi.fn(() => room),
            isDegraded: signal(false),
            degradationReason: signal<string | null>(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomName', 'room-1');
    fixture.componentRef.setInput('otherUserId', 'user-2');
    fixture.componentRef.setInput('currentUserId', 'user-1');
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.restoreAllMocks();
  });

  it('attaches the connected room to the call audio session', async () => {
    await component.ngOnInit();

    expect(audioSession.attach).toHaveBeenCalledTimes(1);
    expect(audioSession.attach).toHaveBeenCalledWith(room, 'call');
    expect(component.connectionState()).toBe('connected');
  });

  it('attaches after connecting and before publishing local tracks', async () => {
    await component.ngOnInit();

    const attachedAt = audioSession.attach.mock.invocationCallOrder[0];
    expect(connect.mock.invocationCallOrder[0]).toBeLessThan(attachedAt);
    expect(attachedAt).toBeLessThan(getUserMedia.mock.invocationCallOrder[0]);
  });

  it('does not attach a room that failed to connect', async () => {
    connect.mockRejectedValue(new Error('network unreachable'));

    await component.ngOnInit();

    expect(audioSession.attach).not.toHaveBeenCalled();
    expect(component.connectionState()).toBe('error');
  });

  it('detaches the room from the audio session before disconnecting when the call ends', async () => {
    await component.ngOnInit();

    component.endCall();

    expect(audioSession.detach).toHaveBeenCalledTimes(1);
    expect(audioSession.detach).toHaveBeenCalledWith(room);
    expect(audioSession.detach.mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0],
    );
  });

  it('has nothing to detach when the call never connected a room', () => {
    component.endCall();

    expect(audioSession.detach).not.toHaveBeenCalled();
  });
});
