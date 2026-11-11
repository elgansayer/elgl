import { describe, it, expect, vi, Mocked, type MockInstance } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { ComponentRef } from '@angular/core';
import { ELAPSED_TICK_MS } from '../../core/reactive/elapsed-seconds';
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

describe('VoipCallComponent encryption indicator', () => {
  let fixture: ComponentFixture<VoipCallComponent>;
  let component: VoipCallComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
      providers: [
        {
          provide: LivekitService,
          useValue: { leaveRoom: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: { currentUser: vi.fn() },
        },
        {
          provide: ChatService,
          useValue: { sendMessage: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('callDirection', 'incoming');
    fixture.componentRef.setInput('remoteUserId', 'user-456');
    fixture.componentRef.setInput('displayName', 'Test User');
    fixture.componentRef.setInput('roomName', 'test-room');
    fixture.detectChanges();
  });

  it('shows the encryption indicator only after the call connects', () => {
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();

    component.callState.set('connected');
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement | null;
    expect(indicator?.textContent).toContain('Encrypted call');

    component.callState.set('ended');
    fixture.detectChanges();
  });
});

describe('VoipCallComponent call timer', () => {
  let fixture: ComponentFixture<VoipCallComponent>;
  let component: VoipCallComponent;
  let leaveRoom: ReturnType<typeof vi.fn>;
  let setIntervalSpy: MockInstance<typeof setInterval>;
  let clearIntervalSpy: MockInstance<typeof clearInterval>;

  beforeEach(async () => {
    vi.useFakeTimers();
    // RxJS `interval` goes through the global timers; spying on them isolates the call clock from
    // the one-shot timers zoneless change detection and Spartan Helm schedule on every update.
    setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    leaveRoom = vi.fn();

    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
      providers: [
        { provide: LivekitService, useValue: { leaveRoom } },
        { provide: AuthService, useValue: { currentUser: vi.fn() } },
        { provide: ChatService, useValue: { sendMessage: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('callDirection', 'incoming');
    fixture.componentRef.setInput('remoteUserId', 'user-456');
    fixture.componentRef.setInput('displayName', 'Test User');
    fixture.componentRef.setInput('roomName', 'test-room');
    fixture.detectChanges();
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  function connect(): void {
    component.callState.set('connected');
    fixture.detectChanges();
  }

  /** Handles of the one-second call clock, ignoring unrelated timers such as Supabase's refresh. */
  function clockHandles(): unknown[] {
    return setIntervalSpy.mock.calls.flatMap(([, delay], index) =>
      delay === ELAPSED_TICK_MS ? [setIntervalSpy.mock.results[index]?.value] : [],
    );
  }

  function clockWasCleared(): boolean {
    const [clock] = clockHandles();
    return clearIntervalSpy.mock.calls.some(([cleared]) => cleared === clock);
  }

  it('does not start a clock before the call connects', () => {
    vi.advanceTimersByTime(5000);

    expect(clockHandles()).toHaveLength(0);
    expect(component.formattedDuration()).toBe('00:00');
  });

  it('counts the connected duration into the formatted clock', () => {
    connect();

    vi.advanceTimersByTime(5000);
    expect(component.callDurationSeconds()).toBe(5);
    expect(component.formattedDuration()).toBe('00:05');

    vi.advanceTimersByTime(55_000);
    expect(component.formattedDuration()).toBe('01:00');
    expect(clockHandles()).toHaveLength(1);
  });

  it('renders the running clock inside the connected call UI', () => {
    connect();
    vi.advanceTimersByTime(7000);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('00:07');
  });

  it('stops the clock as soon as the call leaves the connected state', () => {
    connect();
    vi.advanceTimersByTime(3000);
    expect(clockWasCleared()).toBe(false);

    component.callState.set('ended');
    fixture.detectChanges();

    expect(clockWasCleared()).toBe(true);
    expect(component.callDurationSeconds()).toBe(0);
  });

  it('releases the clock and leaves the room when the component is destroyed', () => {
    connect();
    expect(clockWasCleared()).toBe(false);

    fixture.destroy();

    expect(clockWasCleared()).toBe(true);
    expect(leaveRoom).toHaveBeenCalledOnce();
  });

  it('never starts a clock when the call connects after the component was destroyed', () => {
    fixture.destroy();

    // acceptCall awaits LiveKit and can resolve after the user has left.
    component.callState.set('connected');
    TestBed.tick();
    vi.advanceTimersByTime(5000);

    expect(clockHandles()).toHaveLength(0);
  });
});
