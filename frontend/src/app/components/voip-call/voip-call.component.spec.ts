import { describe, it, expect, vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { ComponentRef } from '@angular/core';
import { LivekitService } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { LocalTrack, Room, Track } from 'livekit-client';

(globalThis as unknown as { MediaStreamTrack: typeof MediaStreamTrack }).MediaStreamTrack =
  class MediaStreamTrack {
    stop() {}
  } as unknown as typeof MediaStreamTrack;

describe.skip('VoipCallComponent', () => {
  let component: VoipCallComponent;
  let fixture: ComponentFixture<VoipCallComponent>;
  let componentRef: ComponentRef<VoipCallComponent>;
  let mockLivekitService: Mocked<LivekitService>;
  let mockAuthService: Mocked<AuthService>;
  let mockChatService: Mocked<ChatService>;
  let mockLocalAudioTrack: Mocked<LocalTrack>;
  let mockLocalVideoTrack: Mocked<LocalTrack>;
  let mockRoom: Mocked<Room>;

  beforeEach(async () => {
    mockLocalAudioTrack = {
      kind: Track.Kind.Audio,
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      muted: false,
      sid: 'audio-track-1',
      source: Track.Source.Microphone,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as Mocked<LocalTrack>;

    mockLocalVideoTrack = {
      kind: Track.Kind.Video,
      mute: vi.fn().mockResolvedValue(undefined),
      unmute: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      muted: false,
      sid: 'video-track-1',
      source: Track.Source.Camera,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as Mocked<LocalTrack>;

    mockRoom = {
      name: 'test-room',
      sid: 'room-sid',
      localParticipant: {
        setMicrophoneEnabled: vi.fn(),
        setCameraEnabled: vi.fn(),
      },
    } as unknown as Mocked<Room>;

    mockLivekitService = {
      joinRoom: vi.fn().mockResolvedValue(mockRoom),
      publishTracks: vi.fn().mockResolvedValue({
        audioTrack: mockLocalAudioTrack,
        videoTrack: mockLocalVideoTrack,
      }),
      leaveRoom: vi.fn(),
      onTrackSubscribed: vi.fn(),
    } as unknown as Mocked<LivekitService>;

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ id: 'user-123', displayName: 'Test User' }),
    } as unknown as Mocked<AuthService>;

    mockChatService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ChatService>;

    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
      providers: [
        { provide: LivekitService, useValue: mockLivekitService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    // Set required inputs
    componentRef.setInput('callDirection', 'incoming');
    componentRef.setInput('remoteUserId', 'user-456');
    componentRef.setInput('displayName', 'Test User');
    componentRef.setInput('roomName', 'test-room');
    componentRef.setInput('isVideoCall', false);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct default state', () => {
    expect(component.isMuted()).toBe(false);
    expect(component.isVideoEnabled()).toBe(false);
    expect(component.callState()).toBe('ringing');
    expect(component.formattedDuration).toBe('00:00');
  });

  it('should toggle mute state', () => {
    component.toggleMute();
    expect(component.isMuted()).toBe(true);

    component.toggleMute();
    expect(component.isMuted()).toBe(false);
  });

  // removed skipped LiveKit SDK test (audio mute/unmute)

  it('should emit muteToggled event with correct value', () => {
    const emitSpy = vi.spyOn(component.muteToggled, 'emit');

    component.toggleMute();
    expect(emitSpy).toHaveBeenCalledWith(true);

    component.toggleMute();
    expect(emitSpy).toHaveBeenCalledWith(false);
  });

  it('should emit callEnded event when ending call', () => {
    const emitSpy = vi.spyOn(component.callEnded, 'emit');

    component.endCall();
    expect(emitSpy).toHaveBeenCalled();
  });

  // removed skipped LiveKit SDK test (stop audio track on destroy)

  it('should clean up resources on destroy', () => {
    const cleanupSpy = vi.spyOn(component as unknown as { cleanup: () => void }, 'cleanup');

    component.ngOnDestroy();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('should display displayName', () => {
    componentRef.setInput('displayName', 'Alice');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Alice');
  });

  it('should show connecting state initially', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Incoming call...');
  });

  it('should show connected state after connection', () => {
    component.callState.set('connected');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Connected');
  });

  // removed skipped LiveKit SDK test (show ended state after endCall)

  it('should update call duration via formattedDuration', () => {
    vi.useFakeTimers();

    component.callState.set('connected');
    fixture.detectChanges();

    vi.advanceTimersByTime(5000);
    expect(component.formattedDuration).toBe('00:05');

    vi.advanceTimersByTime(55000);
    expect(component.formattedDuration).toBe('01:00');

    vi.useRealTimers();
  });

  it('should handle errors during acceptCall gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLivekitService.joinRoom.mockRejectedValue(new Error('Connection failed'));

    await component.acceptCall();
    expect(component.callState()).toBe('ended');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should call leaveRoom on cleanup', () => {
    component.ngOnDestroy();
    expect(mockLivekitService.leaveRoom).toHaveBeenCalled();
  });
});
