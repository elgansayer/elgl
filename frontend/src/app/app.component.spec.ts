vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(), destroy: vi.fn() } }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { AppLockService } from './services/app-lock.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FirebaseMessagingService } from './services/firebase-messaging.service';
import { SafetyService } from './services/safety.service';
import { ReportUserModalService } from './components/report-user-modal/report-user-modal.service';
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionService } from './services/version.service';
import { FontScaleService } from './services/font-scale.service';
import { I18nService } from './services/i18n.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';
import { SeriousLearnerModeService } from './services/serious-learner-mode.service';

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
    claimDailyCheckIn: vi.fn(() => Promise.resolve({ claimed: true, coins_rewarded: 123 })),
    triggerGiftAnimation: vi.fn(),
    activeGiftAnimation: vi.fn(() => null),
  };

  const centrifugeServiceMock = {
    connect: vi.fn(() => Promise.resolve()),
    publish: vi.fn(),
    connectionRevision: signal(0),
    subscribe: vi.fn((_channel: string, cb: (data: unknown) => void) => {
      subscribeCallback = cb;
    }),
  };

  const fcmServiceMock = {
    requestPermissionAndGetToken: vi.fn(() => Promise.resolve()),
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
    snapshot: vi.fn(() => ({
      chat: 0,
      moments: 0,
      discovery: 0,
      audioRooms: 0,
      profile: 0,
    })),
    reconcile: vi.fn(),
    resetAll: vi.fn(),
    setChatUnread: vi.fn(),
    setNotificationUnread: vi.fn(),
    incrementChatUnread: vi.fn(),
    decrementChatUnread: vi.fn(),
    incrementNotificationUnread: vi.fn(),
    decrementNotificationUnread: vi.fn(),
  };

  const versionServiceMock = {
    checkVersion: vi.fn(() => Promise.resolve(false)),
    isDeprecated: vi.fn(() => false),
    updateUrl: vi.fn(() => 'https://github.com/elgansayer/elgl/releases/latest'),
  };

  const fontScaleServiceMock = {
    scaleFactor: vi.fn(() => 1),
  };

  const i18nServiceMock = {
    translate: vi.fn(() => ''),
    currentLocale: vi.fn(() => 'en'),
  };

  const notificationServiceMock = {
    getUnreadCount: vi.fn(() =>
      Promise.resolve({
        unreadCount: 0,
        byTab: { moments: 0, discovery: 0, profile: 0 },
      }),
    ),
    markAllAsRead: vi.fn(() => Promise.resolve()),
    markAsRead: vi.fn(() => Promise.resolve()),
    getNotifications: vi.fn(() => Promise.resolve([])),
  };

  const chatServiceMock = {
    getUnreadCount: vi.fn(() => Promise.resolve(0)),
  };

  const seriousLearnerModeMock = {
    enabled: vi.fn(() => false),
    saving: vi.fn(() => false),
    setEnabled: vi.fn(() => Promise.resolve(true)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    subscribeCallback = undefined;

    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.currentUser.mockReturnValue({ id: 'test-user-1' });
    appLockServiceMock.biometricEnabled.mockReturnValue(false);
    centrifugeServiceMock.connectionRevision.set(0);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: AppLockService, useValue: appLockServiceMock },
        { provide: EconomyStore, useValue: economyStoreMock },
        { provide: CentrifugeService, useValue: centrifugeServiceMock },
        { provide: FirebaseMessagingService, useValue: fcmServiceMock },
        { provide: SafetyService, useValue: safetyServiceMock },
        { provide: ReportUserModalService, useValue: reportModalServiceMock },
        { provide: UnreadCounterService, useValue: unreadCounterMock },
        { provide: VersionService, useValue: versionServiceMock },
        { provide: FontScaleService, useValue: fontScaleServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: ChatService, useValue: chatServiceMock },
        { provide: SeriousLearnerModeService, useValue: seriousLearnerModeMock },
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

  it('should call core services during ngOnInit', async () => {
    expect(versionServiceMock.checkVersion).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.loadInitialData).toHaveBeenCalledTimes(1);
    expect(safetyServiceMock.loadBlockedUsers).toHaveBeenCalledTimes(1);
    expect(economyStoreMock.claimDailyCheckIn).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.connect).toHaveBeenCalledTimes(1);
    expect(centrifugeServiceMock.subscribe).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(fcmServiceMock.requestPermissionAndGetToken).toHaveBeenCalledTimes(1);
      expect(fcmServiceMock.persistFcmToken).toHaveBeenCalled();
    });
  });

  it('loads the initial chat unread count with one service call', async () => {
    chatServiceMock.getUnreadCount.mockClear();
    unreadCounterMock.set.mockClear();
    chatServiceMock.getUnreadCount.mockResolvedValueOnce(7);

    await (
      component as unknown as {
        loadAuthoritativeUnreadCounts(): Promise<void>;
      }
    ).loadAuthoritativeUnreadCounts();

    expect(chatServiceMock.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(unreadCounterMock.set).toHaveBeenCalledWith('chat', 7);
  });

  it('preserves the current chat count when the initial request fails', async () => {
    chatServiceMock.getUnreadCount.mockClear();
    unreadCounterMock.set.mockClear();
    chatServiceMock.getUnreadCount.mockRejectedValueOnce(new Error('unavailable'));

    await (
      component as unknown as {
        loadAuthoritativeUnreadCounts(): Promise<void>;
      }
    ).loadAuthoritativeUnreadCounts();

    expect(unreadCounterMock.set).not.toHaveBeenCalledWith('chat', expect.any(Number));
  });

  it('subscribes before requesting authoritative counts', async () => {
    const order: string[] = [];
    centrifugeServiceMock.subscribe.mockImplementationOnce(
      (_channel: string, cb: (data: unknown) => void) => {
        subscribeCallback = cb;
        order.push('subscribe');
      },
    );
    notificationServiceMock.getUnreadCount.mockImplementationOnce(() => {
      order.push('count');
      return Promise.resolve({
        unreadCount: 0,
        byTab: { moments: 0, discovery: 0, profile: 0 },
      });
    });

    await component.ngOnInit();

    expect(order).toEqual(['subscribe', 'count']);
  });

  it('repeats an authoritative load when an invalidation arrives in flight', async () => {
    let resolveCount: ((value: {
      unreadCount: number;
      byTab: { moments: number; discovery: number; profile: number };
    }) => void) | undefined;
    notificationServiceMock.getUnreadCount
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCount = resolve;
          }),
      )
      .mockResolvedValueOnce({
        unreadCount: 5,
        byTab: { moments: 5, discovery: 0, profile: 0 },
      });
    notificationServiceMock.getUnreadCount.mockClear();
    unreadCounterMock.set.mockClear();

    const initialisation = component.ngOnInit();
    await vi.waitFor(() => {
      expect(resolveCount).toBeDefined();
    });
    subscribeCallback?.({ type: 'unread_count_changed', tab: 'moments' });
    resolveCount?.({
      unreadCount: 4,
      byTab: { moments: 4, discovery: 0, profile: 0 },
    });
    await initialisation;

    expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledTimes(2);
    expect(unreadCounterMock.set).toHaveBeenLastCalledWith('chat', 0);
    expect(unreadCounterMock.set).toHaveBeenCalledWith('moments', 5);
  });

  it('loads unread counts when unrelated startup providers fail', async () => {
    economyStoreMock.loadInitialData.mockRejectedValueOnce(new Error('economy unavailable'));
    safetyServiceMock.loadBlockedUsers.mockRejectedValueOnce(new Error('safety unavailable'));
    notificationServiceMock.getUnreadCount.mockClear();
    chatServiceMock.getUnreadCount.mockClear();

    await component.ngOnInit();

    expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(chatServiceMock.getUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('treats personal unread events as authoritative-count invalidations', async () => {
    expect(subscribeCallback).toBeDefined();
    notificationServiceMock.getUnreadCount.mockClear();
    chatServiceMock.getUnreadCount.mockClear();

    subscribeCallback?.({ type: 'unread_count_changed', tab: 'moments' });

    await vi.waitFor(() => {
      expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledOnce();
      expect(chatServiceMock.getUnreadCount).toHaveBeenCalledOnce();
    });
    expect(unreadCounterMock.increment).not.toHaveBeenCalledWith('moments');
  });

  it('reloads authoritative counts after a realtime reconnect', async () => {
    notificationServiceMock.getUnreadCount.mockClear();
    chatServiceMock.getUnreadCount.mockClear();

    centrifugeServiceMock.connectionRevision.set(1);
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(notificationServiceMock.getUnreadCount).toHaveBeenCalledOnce();
      expect(chatServiceMock.getUnreadCount).toHaveBeenCalledOnce();
    });
  });

  it('counts an incoming call as live-room activity', () => {
    subscribeCallback?.({
      type: 'incoming_call',
      callerId: 'caller-1',
      callerName: 'Caller',
      roomName: 'room-1',
      isVideoCall: false,
    });

    expect(unreadCounterMock.increment).toHaveBeenCalledWith('audioRooms');
  });

  it('clears one live-room activity item when an incoming call is handled', () => {
    const call = {
      callerId: 'caller-1',
      callerName: 'Caller',
      roomName: 'room-1',
      isVideoCall: false,
    };

    component.onDeclineCall(call);

    expect(unreadCounterMock.decrement).toHaveBeenCalledWith('audioRooms');
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

  it('should call versionService on init', () => {
    expect(versionServiceMock.checkVersion).toHaveBeenCalled();
    expect(component.versionService.isDeprecated()).toBe(false);
  });
});
