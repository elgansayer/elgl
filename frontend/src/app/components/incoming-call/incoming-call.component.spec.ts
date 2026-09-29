import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';
import { I18nService } from '../../services/i18n.service';
import { LivekitService } from '../../services/livekit.service';
import { UserService } from '../../services/user.service';
import { IncomingCallComponent, IncomingCallInfo } from './incoming-call.component';

describe('IncomingCallComponent', () => {
  let component: IncomingCallComponent;
  let fixture: ComponentFixture<IncomingCallComponent>;
  let mockCentrifugoService: ReturnType<typeof createCentrifugoMock>;
  let mockAuthService: ReturnType<typeof createAuthMock>;
  let mockLivekitService: ReturnType<typeof createLivekitMock>;
  let userServiceMock: { getMyProfile: ReturnType<typeof vi.fn> };
  let hapticMock: {
    tap: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const callInfo: IncomingCallInfo = {
    callerId: 'caller-456',
    callerName: 'Test Caller',
    roomName: 'room-789',
    isVideo: false,
  };

  function createCentrifugoMock() {
    return {
      subscribe: vi.fn(),
      publish: vi.fn(),
      unsubscribe: vi.fn(),
    };
  }

  function createAuthMock() {
    return {
      currentUser: signal<{ id: string } | null>({ id: 'test-user-123' }),
      getAccessToken: vi.fn().mockReturnValue('token'),
    };
  }

  function createLivekitMock() {
    return {
      joinRoom: vi.fn().mockResolvedValue(undefined),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
    };
  }

  function subscribedCallback(): (data: unknown) => void {
    const callback = mockCentrifugoService.subscribe.mock.calls[0]?.[1] as
      | ((data: unknown) => void)
      | undefined;
    expect(callback).toBeTypeOf('function');
    return callback as (data: unknown) => void;
  }

  beforeEach(async () => {
    mockCentrifugoService = createCentrifugoMock();
    mockAuthService = createAuthMock();
    mockLivekitService = createLivekitMock();
    userServiceMock = {
      getMyProfile: vi.fn().mockResolvedValue({ silence_unknown_callers: false }),
    };
    hapticMock = {
      tap: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };

    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      vi.fn().mockImplementation(() => ({
        loop: false,
        volume: 1,
        play,
        pause: vi.fn(),
      })),
    );

    await TestBed.configureTestingModule({
      imports: [IncomingCallComponent],
      providers: [
        I18nService,
        { provide: CentrifugoService, useValue: mockCentrifugoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LivekitService, useValue: mockLivekitService },
        { provide: UserService, useValue: userServiceMock },
        { provide: HapticFeedbackService, useValue: hapticMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates and subscribes only to the authenticated user channel', () => {
    expect(component).toBeTruthy();
    expect(mockCentrifugoService.subscribe).toHaveBeenCalledWith(
      'user_test-user-123',
      expect.any(Function),
    );
  });

  it('shows a semantic modal for a valid bounded incoming call event', async () => {
    subscribedCallback()({ type: 'incoming_call', callInfo });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.showCallModal()).toBe(true);
    expect(component.callInfo()).toEqual(callInfo);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-modal="true"]')).not.toBeNull();
  });

  it('rejects malformed realtime call payloads before they reach UI state', async () => {
    const callback = subscribedCallback();

    callback({
      type: 'incoming_call',
      callInfo: { ...callInfo, callerId: 'caller/../../other-channel' },
    });
    callback({
      type: 'incoming_call',
      callInfo: { ...callInfo, callerAvatar: 'javascript:alert(1)' },
    });
    callback({
      type: 'incoming_call',
      callInfo: { ...callInfo, isVideo: 'false' },
    });

    await fixture.whenStable();

    expect(component.showCallModal()).toBe(false);
    expect(component.callInfo()).toBeNull();
  });

  it('normalises safe caller metadata before rendering it', async () => {
    subscribedCallback()({
      type: 'incoming_call',
      callInfo: {
        ...callInfo,
        callerName: '  Test Caller  ',
        callerAvatar: 'https://example.com/avatar.jpg',
      },
    });
    await fixture.whenStable();

    expect(component.callInfo()).toEqual({
      ...callInfo,
      callerName: 'Test Caller',
      callerAvatar: 'https://example.com/avatar.jpg',
    });
  });

  it('does not let a second realtime invitation replace the active call', async () => {
    const callback = subscribedCallback();
    callback({ type: 'incoming_call', callInfo });
    await fixture.whenStable();

    callback({
      type: 'incoming_call',
      callInfo: {
        callerId: 'second-caller',
        callerName: 'Second Caller',
        roomName: 'second-room',
        isVideo: true,
      },
    });
    await fixture.whenStable();

    expect(component.callInfo()).toEqual(callInfo);
  });

  it('keeps the visual controls available without ringing when the privacy setting cannot load', async () => {
    userServiceMock.getMyProfile.mockRejectedValue(new Error('provider unavailable'));

    subscribedCallback()({ type: 'incoming_call', callInfo });
    await fixture.whenStable();

    expect(component.showCallModal()).toBe(true);
    expect(component.callInfo()).toEqual(callInfo);
    expect(Audio).not.toHaveBeenCalled();
  });

  it('emits callAccepted and joins LiveKit with the authenticated identity', async () => {
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
    expect(component.callInfo()).toBeNull();
    expect(emitSpy).toHaveBeenCalledWith(callInfo);
  });

  it('keeps the call retryable when LiveKit joining fails', async () => {
    mockLivekitService.joinRoom.mockRejectedValueOnce(new Error('network unavailable'));
    component.callInfo.set(callInfo);
    component.showCallModal.set(true);

    await component.acceptCall();

    expect(component.showCallModal()).toBe(true);
    expect(component.callInfo()).toEqual(callInfo);
    expect(component.callActionPending()).toBe(false);
    expect(mockCentrifugoService.publish).not.toHaveBeenCalled();
    expect(hapticMock.error).toHaveBeenCalledTimes(1);

    mockLivekitService.joinRoom.mockResolvedValueOnce(undefined);
    await component.acceptCall();

    expect(component.showCallModal()).toBe(false);
    expect(component.callInfo()).toBeNull();
    expect(mockLivekitService.joinRoom).toHaveBeenCalledTimes(2);
  });

  it('suppresses duplicate accept mutations while a join is in flight', async () => {
    let resolveJoin!: () => void;
    mockLivekitService.joinRoom.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveJoin = resolve;
        }),
    );
    component.callInfo.set(callInfo);
    component.showCallModal.set(true);

    const firstAccept = component.acceptCall();
    const secondAccept = component.acceptCall();

    expect(component.callActionPending()).toBe(true);
    expect(mockLivekitService.joinRoom).toHaveBeenCalledTimes(1);

    resolveJoin();
    await Promise.all([firstAccept, secondAccept]);

    expect(mockCentrifugoService.publish).toHaveBeenCalledTimes(1);
    expect(component.callActionPending()).toBe(false);
  });

  it('fails closed instead of joining with a synthetic identity after logout', async () => {
    mockAuthService.currentUser.set(null);
    TestBed.flushEffects();
    component.callInfo.set(callInfo);
    component.showCallModal.set(true);

    await component.acceptCall();

    expect(mockLivekitService.joinRoom).not.toHaveBeenCalled();
    expect(mockCentrifugoService.publish).not.toHaveBeenCalled();
    expect(hapticMock.error).toHaveBeenCalledTimes(1);
  });

  it('emits callRejected and notifies the caller once', () => {
    component.callInfo.set(callInfo);
    component.showCallModal.set(true);
    const emitSpy = vi.spyOn(component.callRejected, 'emit');

    component.rejectCall();
    component.rejectCall();

    expect(component.showCallModal()).toBe(false);
    expect(component.callInfo()).toBeNull();
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(callInfo);
    expect(mockCentrifugoService.publish).toHaveBeenCalledTimes(1);
    expect(mockCentrifugoService.publish).toHaveBeenCalledWith('user_caller-456', {
      type: 'call_rejected',
      data: {
        userId: 'test-user-123',
        roomName: 'room-789',
      },
    });
  });
});
