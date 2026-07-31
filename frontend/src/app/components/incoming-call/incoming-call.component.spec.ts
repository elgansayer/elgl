import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncomingCallComponent } from './incoming-call.component';
import { I18nService } from '../../services/i18n.service';
import { UserService } from '../../services/user.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AuthService } from '../../services/auth.service';
import { LivekitService } from '../../services/livekit.service';
import { SafetyService } from '../../services/safety.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('IncomingCallComponent', () => {
  let component: IncomingCallComponent;
  let fixture: ComponentFixture<IncomingCallComponent>;
  let mockCentrifugoService: ReturnType<typeof createCentrifugoMock>;
  let mockAuthService: ReturnType<typeof createAuthMock>;
  let mockLivekitService: ReturnType<typeof createLivekitMock>;
  let mockSafetyService: ReturnType<typeof createSafetyMock>;

  function createCentrifugoMock() {
    return {
      subscribe: vi.fn(),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
    };
  }

  function createAuthMock() {
    return {
      currentUser: signal({ id: 'test-user-123' }),
      getAccessToken: vi.fn().mockReturnValue('token'),
    };
  }

  function createLivekitMock() {
    return {
      joinRoom: vi.fn().mockResolvedValue(undefined),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createSafetyMock() {
    return {
      loadBlockedUserIds: vi.fn().mockResolvedValue(undefined),
      blockedUserIdsSignal: signal(new Set<string>()),
    };
  }

  beforeEach(async () => {
    mockCentrifugoService = createCentrifugoMock();
    mockAuthService = createAuthMock();
    mockLivekitService = createLivekitMock();
    mockSafetyService = createSafetyMock();

    const userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({ silence_unknown_callers: false }),
    };
    const hapticMock = {
      tap: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [IncomingCallComponent],
      providers: [
        I18nService,
        { provide: CentrifugoService, useValue: mockCentrifugoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LivekitService, useValue: mockLivekitService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: UserService, useValue: userServiceMock },
        { provide: HapticFeedbackService, useValue: hapticMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
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

    const subscribeCallback = mockCentrifugoService.subscribe.mock.calls[0]?.[1];
    if (subscribeCallback) {
      subscribeCallback({ type: 'incoming_call', callInfo });
    }

    fixture.detectChanges();
    TestBed.flushEffects();
    expect(component.showCallModal()).toBe(true);
    expect(component.callInfo()).toEqual(callInfo);
  });

  it('should emit callAccepted and join LiveKit room on accept', async () => {
    const callInfo = {
      callerId: 'caller-456',
      callerName: 'Test Caller',
      roomName: 'room-789',
      isVideo: false,
    };

    component.callInfo.set(callInfo);
    component.showCallModal.set(true);

    const emitSpy = vi.spyOn(component.callAccepted, 'emit');

    await component.acceptCall();

    expect(mockLivekitService.joinRoom).toHaveBeenCalledWith(
      'room-789',
      'test-user-123',
      false,
      undefined,
    );
    expect(mockCentrifugoService.publish).toHaveBeenCalledWith('user_caller-456', {
      type: 'call_accepted',
      data: {
        userId: 'test-user-123',
        roomName: 'room-789',
      },
    });
    expect(component.showCallModal()).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(callInfo);
  });

  it('should emit callRejected and notify caller on reject', () => {
    const callInfo = {
      callerId: 'caller-456',
      callerName: 'Test Caller',
      roomName: 'room-789',
      isVideo: false,
    };

    component.callInfo.set(callInfo);
    component.showCallModal.set(true);

    const emitSpy = vi.spyOn(component.callRejected, 'emit');

    component.rejectCall();

    expect(component.showCallModal()).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(callInfo);
    expect(mockCentrifugoService.publish).toHaveBeenCalledWith('user_caller-456', {
      type: 'call_rejected',
      data: {
        userId: 'test-user-123',
        roomName: 'room-789',
      },
    });
  });
});
