import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { ComponentRef } from '@angular/core';
import { LivekitService } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { LocalTrack, RemoteTrack, Room, Track } from 'livekit-client';

describe('VoipCallComponent', () => {
  let component: VoipCallComponent;
  let fixture: ComponentFixture<VoipCallComponent>;
  let componentRef: ComponentRef<VoipCallComponent>;
  let mockLivekitService: jest.Mocked<LivekitService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockChatService: jest.Mocked<ChatService>;
  let mockLocalAudioTrack: jest.Mocked<LocalTrack>;
  let mockLocalVideoTrack: jest.Mocked<LocalTrack>;
  let mockRemoteAudioTrack: jest.Mocked<RemoteTrack>;
  let mockRemoteVideoTrack: jest.Mocked<RemoteTrack>;
  let mockRoom: jest.Mocked<Room>;

  beforeEach(async () => {
    mockLocalAudioTrack = {
      kind: Track.Kind.Audio,
      setMuted: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      muted: false,
      sid: 'audio-track-1',
      source: Track.Source.Microphone,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as jest.Mocked<LocalTrack>;

    mockLocalVideoTrack = {
      kind: Track.Kind.Video,
      setMuted: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      muted: false,
      sid: 'video-track-1',
      source: Track.Source.Camera,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as jest.Mocked<LocalTrack>;

    mockRemoteAudioTrack = {
      kind: Track.Kind.Audio,
      sid: 'remote-audio-1',
      source: Track.Source.Microphone,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as jest.Mocked<RemoteTrack>;

    mockRemoteVideoTrack = {
      kind: Track.Kind.Video,
      sid: 'remote-video-1',
      source: Track.Source.Camera,
      mediaStreamTrack: new MediaStreamTrack(),
    } as unknown as jest.Mocked<RemoteTrack>;

    mockRoom = {
      name: 'test-room',
      sid: 'room-sid',
      localParticipant: {
        setMicrophoneEnabled: jest.fn(),
        setCameraEnabled: jest.fn(),
      },
    } as unknown as jest.Mocked<Room>;

    mockLivekitService = {
      joinRoom: jest.fn().mockResolvedValue(mockRoom),
      publishTracks: jest.fn().mockResolvedValue({
        audioTrack: mockLocalAudioTrack,
        videoTrack: mockLocalVideoTrack,
      }),
      leaveRoom: jest.fn(),
      onTrackSubscribed: jest.fn(),
    } as unknown as jest.Mocked<LivekitService>;

    mockAuthService = {
      currentUser: jest.fn().mockReturnValue({ id: 'user-123', displayName: 'Test User' }),
    } as unknown as jest.Mocked<AuthService>;

    mockChatService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ChatService>;

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

  it('should mute/unmute the local audio track via LiveKit SDK', () => {
    (component as any).localAudioTrack = mockLocalAudioTrack;

    component.toggleMute();
    expect(component.isMuted()).toBe(true);
    expect(mockLocalAudioTrack.setMuted).toHaveBeenCalledWith(true);

    component.toggleMute();
    expect(component.isMuted()).toBe(false);
    expect(mockLocalAudioTrack.setMuted).toHaveBeenCalledWith(false);
  });

  it('should emit muteToggled event with correct value', () => {
    const emitSpy = jest.spyOn(component.muteToggled, 'emit');

    component.toggleMute();
    expect(emitSpy).toHaveBeenCalledWith(true);

    component.toggleMute();
    expect(emitSpy).toHaveBeenCalledWith(false);
  });

  it('should emit callEnded event when ending call', () => {
    const emitSpy = jest.spyOn(component.callEnded, 'emit');

    component.endCall();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should stop local audio track on destroy', () => {
    (component as any).localAudioTrack = mockLocalAudioTrack;
    const stopSpy = jest.spyOn(mockLocalAudioTrack, 'stop');

    component.ngOnDestroy();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('should clean up resources on destroy', () => {
    const cleanupSpy = jest.spyOn(component as any, 'cleanup');

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

  it('should show ended state after endCall', () => {
    component.endCall();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Call ended');
  });

  it('should update call duration via formattedDuration', () => {
    jest.useFakeTimers();

    component.callState.set('connected');
    fixture.detectChanges();

    jest.advanceTimersByTime(5000);
    expect(component.formattedDuration).toBe('00:05');

    jest.advanceTimersByTime(55000);
    expect(component.formattedDuration).toBe('01:00');

    jest.useRealTimers();
  });

  it('should handle errors during acceptCall gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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
