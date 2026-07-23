import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { ComponentRef } from '@angular/core';

describe('VoipCallComponent', () => {
  let component: VoipCallComponent;
  let fixture: ComponentFixture<VoipCallComponent>;
  let componentRef: ComponentRef<VoipCallComponent>;
  let mockLocalAudioTrack: { muted: boolean; stop: jest.Mock };

  beforeEach(async () => {
    mockLocalAudioTrack = {
      muted: false,
      stop: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    // Set required inputs
    componentRef.setInput('roomName', 'test-room');
    componentRef.setInput('token', 'test-token');
    componentRef.setInput('callerName', 'Test User');
    componentRef.setInput('isVideoCall', false);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct default state', () => {
    expect(component.isMuted()).toBe(false);
    expect(component.isConnecting()).toBe(true);
    expect(component.isConnected()).toBe(false);
    expect(component.callDuration()).toBe('00:00');
  });

  it('should toggle mute state', () => {
    component.toggleMute();
    expect(component.isMuted()).toBe(true);

    component.toggleMute();
    expect(component.isMuted()).toBe(false);
  });

  it('should mute/unmute the local audio track via LiveKit SDK', () => {
    // Set up the local audio track
    (component as any).localAudioTrack = mockLocalAudioTrack;

    component.toggleMute();
    expect(component.isMuted()).toBe(true);
    expect(mockLocalAudioTrack.muted).toBe(true);

    component.toggleMute();
    expect(component.isMuted()).toBe(false);
    expect(mockLocalAudioTrack.muted).toBe(false);
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

  it('should display caller name', () => {
    componentRef.setInput('callerName', 'Alice');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Alice');
  });

  it('should display call type correctly', () => {
    // Voice call
    componentRef.setInput('isVideoCall', false);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Voice Call');

    // Video call
    componentRef.setInput('isVideoCall', true);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Video Call');
  });

  it('should show connecting state initially', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Connecting...');
  });

  it('should show connected state after connection', () => {
    component['isConnected'].set(true);
    component['isConnecting'].set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Connected');
  });

  it('should show disconnected state after cleanup', () => {
    component.ngOnDestroy();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Disconnected');
  });

  it('should update call duration', () => {
    jest.useFakeTimers();

    component['startTime'] = Date.now();
    component['startDurationTimer']();

    jest.advanceTimersByTime(5000);
    expect(component.callDuration()).toBe('00:05');

    jest.advanceTimersByTime(55000);
    expect(component.callDuration()).toBe('01:00');

    jest.useRealTimers();
  });

  it('should handle mute button click', () => {
    const toggleSpy = jest.spyOn(component, 'toggleMute');

    const compiled = fixture.nativeElement as HTMLElement;
    const muteButton = compiled.querySelector('app-button-secondary');
    expect(muteButton).toBeTruthy();

    muteButton?.click();
    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should handle end call button click', () => {
    const endCallSpy = jest.spyOn(component, 'endCall');

    const compiled = fixture.nativeElement as HTMLElement;
    const endCallButton = compiled.querySelector('app-button-primary');
    expect(endCallButton).toBeTruthy();

    endCallButton?.click();
    expect(endCallSpy).toHaveBeenCalled();
  });

  it('should show mute icon when muted', () => {
    component.isMuted.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unmute');
  });

  it('should show unmute icon when not muted', () => {
    component.isMuted.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Mute');
  });

  it('should have correct ARIA attributes', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const dialog = compiled.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-label')).toBe('Voice/Video Call');
  });

  it('should handle errors during room initialization gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Mock the room connect to throw
    jest.spyOn(component as any, 'initializeRoom').mockRejectedValue(new Error('Connection failed'));

    await component.ngOnInit();
    expect(component.isConnecting()).toBe(false);
    expect(component.isConnected()).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
