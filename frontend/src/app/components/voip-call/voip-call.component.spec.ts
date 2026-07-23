import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { LivekitService } from '../../services/livekit.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { signal } from '@angular/core';

describe('VoipCallComponent', () => {
  let component: VoipCallComponent;
  let fixture: ComponentFixture<VoipCallComponent>;
  let i18nServiceMock: Partial<I18nService>;
  let centrifugoServiceMock: jasmine.SpyObj<CentrifugoService>;
  let livekitServiceMock: jasmine.SpyObj<LivekitService>;
  let authServiceMock: Partial<AuthService>;
  let chatServiceMock: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: (key: string) => key,
    };

    centrifugoServiceMock = jasmine.createSpyObj('CentrifugoService', ['subscribe', 'unsubscribe', 'publish']);
    livekitServiceMock = jasmine.createSpyObj('LivekitService', ['joinRoom', 'publishTracks', 'leaveRoom', 'setMicrophoneEnabled', 'setCameraEnabled']);
    authServiceMock = {
      currentUser: () => ({ id: 'current-user', displayName: 'Current User' }),
    };
    chatServiceMock = jasmine.createSpyObj('ChatService', ['sendMessage']);

    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: CentrifugoService, useValue: centrifugoServiceMock },
        { provide: LivekitService, useValue: livekitServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('callDirection', 'incoming');
    fixture.componentRef.setInput('remoteUserId', 'user-123');
    fixture.componentRef.setInput('displayName', 'Test User');
    fixture.componentRef.setInput('roomName', 'call_room_123');
    fixture.componentRef.setInput('isVideoCall', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should subscribe to user personal Centrifugo channel on init', () => {
    expect(centrifugoServiceMock.subscribe).toHaveBeenCalledWith(
      'user_user-123',
      jasmine.any(Function)
    );
  });

  it('should unsubscribe from user personal Centrifugo channel on destroy', () => {
    fixture.destroy();
    expect(centrifugoServiceMock.unsubscribe).toHaveBeenCalledWith('user_user-123');
  });

  it('should emit callAccepted when accept is clicked', async () => {
    spyOn(component.callAccepted, 'emit');
    livekitServiceMock.joinRoom.and.resolveTo();
    livekitServiceMock.publishTracks.and.resolveTo();

    const acceptButton = fixture.nativeElement.querySelector('button');
    await acceptButton?.click();

    expect(component.callAccepted.emit).toHaveBeenCalledWith({
      roomName: 'call_room_123',
      participant: { userId: 'user-123' },
    });
    expect(livekitServiceMock.joinRoom).toHaveBeenCalledWith('call_room_123', 'current-user', false);
  });

  it('should publish call events via Centrifugo to user personal channel', () => {
    component.rejectCall();
    expect(centrifugoServiceMock.publish).toHaveBeenCalledWith(
      'user_user-123',
      jasmine.objectContaining({ type: 'rejected', roomName: 'call_room_123' })
    );
  });

  it('should toggle mute state', () => {
    expect(component.isMuted()).toBe(false);
    component.toggleMute();
    expect(component.isMuted()).toBe(true);
    expect(livekitServiceMock.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(centrifugoServiceMock.publish).toHaveBeenCalledWith(
      'user_user-123',
      jasmine.objectContaining({ type: 'mute_toggle', muted: true })
    );
  });

  it('should toggle video state', () => {
    expect(component.isVideoEnabled()).toBe(false);
    component.toggleVideo();
    expect(component.isVideoEnabled()).toBe(true);
    expect(livekitServiceMock.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(centrifugoServiceMock.publish).toHaveBeenCalledWith(
      'user_user-123',
      jasmine.objectContaining({ type: 'video_toggle', enabled: true })
    );
  });

  it('should emit callEnded on endCall', () => {
    const endSpy = jasmine.createSpy();
    component.callEnded.subscribe(endSpy);
    
    component.endCall();
    expect(endSpy).toHaveBeenCalledWith({
      roomName: 'call_room_123',
      duration: 0,
    });
  });

  it('should start duration timer when call state becomes connected', () => {
    jasmine.clock().install();
    fixture.componentRef.setInput('callState', 'connected');
    fixture.detectChanges();
    
    expect(component.callDuration()).toBe(0);
    
    jasmine.clock().tick(5000);
    expect(component.callDuration()).toBe(5);
    
    jasmine.clock().uninstall();
  });

  it('should stop duration timer when call ends', () => {
    jasmine.clock().install();
    fixture.componentRef.setInput('callState', 'connected');
    fixture.detectChanges();
    
    jasmine.clock().tick(3000);
    
    fixture.componentRef.setInput('callState', 'ended');
    fixture.detectChanges();
    
    const durationBeforeEnd = component.callDuration();
    jasmine.clock().tick(5000);
    expect(component.callDuration()).toBe(durationBeforeEnd);
    
    jasmine.clock().uninstall();
  });
});
