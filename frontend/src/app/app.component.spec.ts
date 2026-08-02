import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/router/testing';
import { DOCUMENT } from '@angular/common';
import { vi } from 'vitest';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FcmService } from './services/fcm.service';
import { SafetyService } from './services/safety.service';
import { ReportUserModalService } from './components/report-user-modal/report-user-modal.service';
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionCheckService } from './services/version-check.service';
import { FontScaleService } from './services/font-scale.service';
import { I18nService } from './services/i18n.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let subscribeCallback: ((data: unknown) => void) | undefined;

  const authServiceMock = {
    isAuthenticated: vi.fn(() => true),
    isBiometricSupported: vi.fn(() => Promise.resolve(true)),
    biometricLockEnabled: vi.fn(() => false),
    lockApp: vi.fn(),
    enableBiometricLock: vi.fn(() => Promise.resolve()),
    disableBiometricLock: vi.fn(() => Promise.resolve()),
    currentUser: vi.fn(() => ({ id: 'test-user-1' })),
  };

  const economyStoreMock = {
    loadInitialData: vi.fn(() => Promise.resolve()),
    claimDailyCheckIn: vi.fn(() =>
      Promise.resolve({ claimed: true, coins_rewarded: 123 }),
    ),
    triggerGiftAnimation: vi.fn(),
  };

  const centrifugeServiceMock = {
    connect: vi.fn(() => Promise.resolve()),
    subscribe: vi.fn((_channel: string, cb: (data: unknown) => void) => {
      subscribeCallback = cb;
    }),
  };

  const fcmServiceMock = {
    requestPermission: vi.fn(() => Promise.resolve()),
    persistFcmToken: vi.fn(() => Promise.resolve()),
  };

  const safetyServiceMock = {
    loadBlockedUsers: vi.fn(() => Promise.resolve()),
  };

  const reportModalServiceMock = {
    registerModal: vi.fn(),
  };

  const unreadCounterMock = {
    totalUnread: vi.fn(() => 0),
  };

  const versionCheckServiceMock = {
    checkVersion: vi.fn(() => Promise.resolve()),
  };

  const fontScaleServiceMock = {
    scaleFactor: vi.fn(() => 1),
  };

  const i18nServiceMock = {
    translate: vi.fn(() => ''),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    subscribeCallback = undefined;

    // Default resetts that keep the component in a known state
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.biometricLockEnabled.mockReturnValue(false);
    authServiceMock.currentUser.mockReturnValue({ id: 'test-user-1' });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: EconomyStore, useValue: economyStoreMock },
        { provide: CentrifugeService, useValue: centrifugeServiceMock },
        { provide: FcmService, useValue: fcmServiceMock },
        { provide: SafetyService, useValue: safetyServiceMock },
        { provide: ReportUserModalService, useValue: reportModalServiceMock },
        { provide: UnreadCounterService, useValue: unreadCounterMock },
        { provide: VersionCheckService, useValue: versionCheckServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: I18nService, useValue: i18nServiceMock as unknown as I18nService },
        { provide: DOCUMENT, useValue: document },
      ],
    })
      .overrideComponent(AppComponent, {
        set: {
          template:
            '<router-outlet></router-outlet><div #reportModal></div>',
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise unread counter computed values', () => {
    expect(component.totalUnread()).toBe(0);
    expect(component.hasUnread()).toBe(false);
    expect(component.unreadDisplayValue()).toBe('0');
  });

  it('should call core services during ngOnInit', () => {
    expect(versionCheckServiceMock.checkVersion).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.loadInitialData).toHaveBeenCalledTimes(1);
    expect(safetyServiceMock.loadBlockedUsers).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.claimDailyCheckIn).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.connect).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.subscribe).toHaveBeenCalledTimes(1);
    expect(fcmServiceMock.requestPermission).toHaveBeenCalledTimes(1);
    expect(fcmServiceMock.persistFcmToken).toHaveBeenCalledWith('test-user-1');
  });

  it('should trigger gift animation when receiving a virtual_gift payload', () => {
    expect(subscribeCallback).toBeDefined();

    const payload = {
      type: 'virtual_gift',
      gift: { id: 'gift-1' },
      sender_name: 'Alice',
    };
    subscribeCallback?.(payload);
    expect(economyStoreMock.triggerGiftAnimation).toHaveBeenCalledWith({
      gift: payload.gift,
      sender_name: 'Alice',
      receiver_name: 'You',
    });
  });

  it('should set incomingCallData for a valid incoming_call payload', () => {
    expect(subscribeCallback).toBeDefined();
    const payload = {
      type: 'incoming_call',
      callerId: 'caller-1',
      callerName: 'Bob',
      callerAvatarUrl: 'http://avatar',
      roomName: 'room-1',
      isVideoCall: false,
    };
    subscribeCallback?.(payload);
    const callData = component.incomingCallData();
    expect(callData?.callerId).toBe('caller-1');
    expect(callData?.callerName).toBe('Bob');
    expect(callData?.callerAvatarUrl).toBe('http://avatar');
    expect(callData?.roomName).toBe('room-1');
    expect(callData?.isVideoCall).toBe(false);
  });

  it('should not alter incomingCallData for a non-incoming call payload', () => {
    expect(subscribeCallback).toBeDefined();
    const payload = {
      type: 'text_message',
      text: 'hello',
    };
    subscribeCallback?.(payload);
    expect(component.incomingCallData()).toBeNull();
  });

  it('should toggle biometric lock on when currently disabled', async () => {
    authServiceMock.biometricLockEnabled.mockReturnValue(false);
    await component.toggleBiometricLock();
    expect(authServiceMock.enableBiometricLock).toHaveBeenCalledTimes(1);
    expect(authServiceMock.disableBiometricLock).not.toHaveBeenCalled();
  });

  it('should toggle biometric lock off when currently enabled', async () => {
    authServiceMock.biometricLockEnabled.mockReturnValue(true);
    await component.toggleBiometricLock();
    expect(authServiceMock.disableBiometricLock).toHaveBeenCalledTimes(1);
    expect(authServiceMock.enableBiometricLock).not.toHaveBeenCalled();
  });

  it('should set biometricBusy during toggle', async () => {
    authServiceMock.biometricLockEnabled.mockReturnValue(false);
    expect(component.biometricBusy()).toBe(false);
    const promise = component.toggleBiometricLock();
    expect(component.biometricBusy()).toBe(true);
    await promise;
    expect(component.biometricBusy()).toBe(false);
  });
});
