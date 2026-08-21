vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(), destroy: vi.fn() } }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { DOCUMENT } from '@angular/common';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { AppLockService } from './services/app-lock.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FcmService } from './services/fcm.service';
import { SafetyService } from './services/safety.service';
import { ReportUserModalService } from './components/report-user-modal/report-user-modal.service';
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionCheckService } from './services/version-check.service';
import { FontScaleService } from './services/font-scale.service';
import { I18nService } from './services/i18n.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let subscribeCallback: ((data: unknown) => void) | undefined;

  const authServiceMock = {
    isAuthenticated: vi.fn(() => true),
    currentUser: vi.fn(() => ({ id: 'test-user-1' })),
getAccessToken: vi.fn(() => 'mock-token'),
  unlockApp: vi.fn(),
  appLocked: vi.fn(() => false),
  biometricLockEnabled: vi.fn(() => false),
  };

  const appLockServiceMock = {
    isBiometricSupported: vi.fn(() => Promise.resolve(true)),
    biometricEnabled: vi.fn(() => false),
    appLocked: vi.fn(() => false),
    lockNow: vi.fn(),
    enableBiometricLock: vi.fn(() => Promise.resolve(true)),
    disableBiometricLock: vi.fn(() => Promise.resolve(true)),
  };

  const economyStoreMock = {
    loadInitialData: vi.fn(() => Promise.resolve()),
    claimDailyCheckIn: vi.fn(() =>
      Promise.resolve({ claimed: true, coins_rewarded: 123 }),
    ),
    triggerGiftAnimation: vi.fn(),
    activeGiftAnimation: vi.fn(() => null),
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
    tabCount: vi.fn(() => 0),
    set: vi.fn(),
    increment: vi.fn(),
    decrement: vi.fn(),
    resetAll: vi.fn(),
    setChatUnread: vi.fn(),
    setNotificationUnread: vi.fn(),
    incrementChatUnread: vi.fn(),
    decrementChatUnread: vi.fn(),
    incrementNotificationUnread: vi.fn(),
    decrementNotificationUnread: vi.fn(),
  };

  const versionCheckServiceMock = {
    checkVersion: vi.fn(),
    isDeprecated: vi.fn(() => false),
  };

  const fontScaleServiceMock = {
    scaleFactor: vi.fn(() => 1),
  };

  const i18nServiceMock = {
    translate: vi.fn(() => ''),
    currentLocale: vi.fn(() => 'en'),
  };

  const notificationServiceMock = {
    getUnreadCount: vi.fn(() => Promise.resolve(0)),
    markAllAsRead: vi.fn(() => Promise.resolve()),
    markAsRead: vi.fn(() => Promise.resolve()),
    getNotifications: vi.fn(() => Promise.resolve([])),
  };

  const chatServiceMock = {
    getRooms: vi.fn(() => Promise.resolve([])),
    getMessages: vi.fn(() => Promise.resolve([])),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    subscribeCallback = undefined;

    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.currentUser.mockReturnValue({ id: 'test-user-1' });
    appLockServiceMock.biometricEnabled.mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: AppLockService, useValue: appLockServiceMock },
        { provide: EconomyStore, useValue: economyStoreMock },
        { provide: CentrifugeService, useValue: centrifugeServiceMock },
        { provide: FcmService, useValue: fcmServiceMock },
        { provide: SafetyService, useValue: safetyServiceMock },
        { provide: ReportUserModalService, useValue: reportModalServiceMock },
        { provide: UnreadCounterService, useValue: unreadCounterMock },
        { provide: VersionCheckService, useValue: versionCheckServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
        { provide: DOCUMENT, useValue: document },
      ],
    })
      .overrideComponent(AppComponent, {
        set: {
          template: '<router-outlet></router-outlet><div #reportModal></div>',
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

it('should initialise unread counter', () => {
    expect(component.unreadCounter.totalUnread()).toBe(0);
  });

  it('should call core services during ngOnInit', () => {
    expect(versionCheckServiceMock.checkVersion).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.loadInitialData).toHaveBeenCalledTimes(1);
    expect(safetyServiceMock.loadBlockedUsers).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.claimDailyCheckIn).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.connect).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.subscribe).toHaveBeenCalledTimes(1);
    expect(fcmServiceMock.requestPermission).toHaveBeenCalledTimes(1);
    expect(fcmServiceMock.persistFcmToken).toHaveBeenCalled();
  });

  it('should trigger gift animation when receiving a virtual_gift payload', () => {
    expect(subscribeCallback).toBeDefined();

    const payload = {
      type: 'virtual_gift',
      gift_id: 'gift-1',
      gift_name: 'Rose',
      icon: '🌹',
      cost_coins: 10,
      coin_value: 10,
      animation_type: 'confetti',
      animation_url: '',
      sender_name: 'Alice',
    };
    subscribeCallback?.(payload);
    expect(economyStoreMock.triggerGiftAnimation).toHaveBeenCalledWith({
      gift: {
        id: 'gift-1',
        name: 'Rose',
        icon: '🌹',
        cost_coins: 10,
        animation_type: 'confetti',
        animationUrl: undefined,
      },
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
    appLockServiceMock.biometricEnabled.mockReturnValue(false);
    await component.toggleBiometricLock();
    expect(appLockServiceMock.enableBiometricLock).toHaveBeenCalledTimes(1);
    expect(appLockServiceMock.disableBiometricLock).not.toHaveBeenCalled();
  });

  it('should toggle biometric lock off when currently enabled', async () => {
    appLockServiceMock.biometricEnabled.mockReturnValue(true);
    await component.toggleBiometricLock();
    expect(appLockServiceMock.disableBiometricLock).toHaveBeenCalledTimes(1);
    expect(appLockServiceMock.enableBiometricLock).not.toHaveBeenCalled();
  });

  it('should set biometricBusy during toggle', async () => {
    appLockServiceMock.biometricEnabled.mockReturnValue(false);
    expect(component.biometricBusy()).toBe(false);
    const promise = component.toggleBiometricLock();
    expect(component.biometricBusy()).toBe(true);
    await promise;
    expect(component.biometricBusy()).toBe(false);
  });

  it('should call versionCheckService on init', () => {
    expect(versionCheckServiceMock.checkVersion).toHaveBeenCalled();
    expect(component.versionCheckService.isDeprecated()).toBe(false);
  });
});
