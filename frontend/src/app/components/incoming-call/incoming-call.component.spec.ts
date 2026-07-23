import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncomingCallComponent } from './incoming-call.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { LivekitService } from '../../services/livekit.service';
import { signal } from '@angular/core';

describe('IncomingCallComponent', () => {
  let component: IncomingCallComponent;
  let fixture: ComponentFixture<IncomingCallComponent>;
  let mockCentrifugoService: jasmine.SpyObj<CentrifugoService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockLivekitService: jasmine.SpyObj<LivekitService>;

  beforeEach(async () => {
    mockCentrifugoService = jasmine.createSpyObj('CentrifugoService', ['subscribe', 'publish']);
    mockAuthService = jasmine.createSpyObj('AuthService', ['currentUser', 'getAccessToken'], {
      currentUser: signal({ id: 'test-user-123' }),
    });
    mockLivekitService = jasmine.createSpyObj('LivekitService', ['joinRoom', 'leaveRoom']);

    await TestBed.configureTestingModule({
      imports: [IncomingCallComponent],
      providers: [
        I18nService,
        { provide: CentrifugoService, useValue: mockCentrifugoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LivekitService, useValue: mockLivekitService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show call modal when incoming call event is received', () => {
    const callInfo = {
      callerId: 'caller-456',
      callerName: 'Test Caller',
      roomName: 'room-789',
      isVideo: false,
    };

    const subscribeCallback = mockCentrifugoService.subscribe.calls.argsFor(0)[1];
    subscribeCallback({ type: 'incoming_call', callInfo });

    expect(component.showCallModal()).toBeTrue();
    expect(component.callInfo()).toEqual(callInfo);
  });

  it('should emit callAccepted and join LiveKit room on accept', async () => {
    const callInfo = {
      callerId: 'caller-456',
      callerName: 'Test Caller',
      roomName: 'room-789',
      isVideo: false,
    };

    const subscribeCallback = mockCentrifugoService.subscribe.calls.argsFor(0)[1];
    subscribeCallback({ type: 'incoming_call', callInfo });

    spyOn(component.callAccepted, 'emit');

    await component.acceptCall();

    expect(mockLivekitService.joinRoom).toHaveBeenCalledWith('room-789', 'test-user-123', false);
    expect(mockCentrifugoService.publish).toHaveBeenCalledWith('user_caller-456', {
      type: 'call_accepted',
      data: {
        userId: 'test-user-123',
        roomName: 'room-789',
      },
    });
    expect(component.showCallModal()).toBeFalse();
    expect(component.callAccepted.emit).toHaveBeenCalledWith(callInfo);
  });

  it('should emit callRejected and notify caller on reject', () => {
    const callInfo = {
      callerId: 'caller-456',
      callerName: 'Test Caller',
      roomName: 'room-789',
      isVideo: false,
    };

    const subscribeCallback = mockCentrifugoService.subscribe.calls.argsFor(0)[1];
    subscribeCallback({ type: 'incoming_call', callInfo });

    spyOn(component.callRejected, 'emit');

    component.rejectCall();

    expect(component.showCallModal()).toBeFalse();
    expect(component.callRejected.emit).toHaveBeenCalledWith(callInfo);
    expect(mockCentrifugoService.publish).toHaveBeenCalledWith('user_caller-456', {
      type: 'call_rejected',
      data: {
        userId: 'test-user-123',
        roomName: 'room-789',
      },
    });
  });
});
