import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
  afterNextRender,
  effect,
  DestroyRef,
} from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FirebaseMessagingService } from './services/firebase-messaging.service';
import { SafetyService } from './services/safety.service';
import { TranslatePipe } from './services/translate.pipe';
import {
  IncomingCallModalComponent,
  IncomingCallData,
} from './components/incoming-call-modal/incoming-call-modal.component';
import { ToastComponent } from './components/primitives/toast/toast.component';
import { ReportUserModalComponent } from './components/report-user-modal/report-user-modal.component';
import { ReportUserModalService } from './components/report-user-modal/report-user-modal.service';
import { DailyLoginModalComponent } from './components/daily-login-modal/daily-login-modal.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ConversationAnalysisLauncherComponent } from './features/premium-ai/conversation-analysis-launcher.component';
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionService } from './services/version.service';
import { ForcedUpdateModalComponent } from './components/forced-update-modal/forced-update-modal.component';
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';
import { FontScaleSliderComponent } from './components/font-scale-slider/font-scale-slider.component';
import { FontScaleService } from './services/font-scale.service';
import { I18nService } from './services/i18n.service';
import { AppLanguageSelectorComponent } from './components/app-language-selector/app-language-selector.component';
import { AppLockService } from './services/app-lock.service';
import { GiftAnimationOverlayComponent } from './components/gift-animation-overlay/gift-animation-overlay.component';
import { NoNetworkBannerComponent } from './components/primitives/no-network-banner/no-network-banner.component';
import { DesktopSidebarComponent } from './components/desktop-sidebar/desktop-sidebar.component';
import { MobileNavigationComponent } from './components/mobile-navigation/mobile-navigation.component';
import { TourService } from './services/tour.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';
import { SeriousLearnerModeService } from './services/serious-learner-mode.service';
import { JoyrideModule } from 'ngx-joyride';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

@Component({
  selector: 'app-root',
  imports: [
    HlmButton,
    RouterOutlet,
    RouterLink,
    TranslatePipe,
    IncomingCallModalComponent,
    ToastComponent,
    ReportUserModalComponent,
    DailyLoginModalComponent,
    ConfirmDialogComponent,
    ConversationAnalysisLauncherComponent,
    ThemeSelectorComponent,
    FontScaleSliderComponent,
    AppLanguageSelectorComponent,
    GiftAnimationOverlayComponent,
    ForcedUpdateModalComponent,
    NoNetworkBannerComponent,
    DesktopSidebarComponent,
    MobileNavigationComponent,
    JoyrideModule,
  ],
  templateUrl: './app.component.html',
  host: {
    '[class.app-locked]': 'appLockService.appLocked()',
  },
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';

  public startProductTour(): void {
    this.tourService.startEconomyTour();
  }
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  private tourService = inject(TourService);
  centrifugeService = inject(CentrifugeService);
  fcmService = inject(FirebaseMessagingService);
  private safetyService = inject(SafetyService);
  reportModalService = inject(ReportUserModalService);
  readonly unreadCounter = inject(UnreadCounterService);
  readonly versionService = inject(VersionService);
  readonly seriousLearnerMode = inject(SeriousLearnerModeService);
  private fontScaleService = inject(FontScaleService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  readonly appLockService = inject(AppLockService);
  private readonly router = inject(Router);
  private notificationService = inject(NotificationService);
  private chatService = inject(ChatService);
  private unreadSyncActive = false;
  private unreadRefreshRequested = false;
  private unreadRefreshPromise: Promise<void> | null = null;
  private handledConnectionRevision = 0;

  private routerOutlet = viewChild.required(RouterOutlet);

  // Incoming call state
  readonly incomingCallData = signal<IncomingCallData | null>(null);
  // Biometric lock state
  readonly biometricAvailable = signal<boolean>(false);
  readonly biometricBusy = signal<boolean>(false);
  readonly biometricLockEnabled = computed(() => this.appLockService.biometricEnabled());
  readonly biometricControlsVisible = computed(
    () => this.authService.isAuthenticated() && this.biometricAvailable(),
  );

  // Daily reward state
  readonly dailyRewardCoins = signal<number>(0);
  readonly showDailyRewardModal = signal<boolean>(false);

  readonly reportModal = viewChild.required<ReportUserModalComponent>('reportModal');

  constructor() {
    afterNextRender(() => {
      this.reportModalService.registerModal(this.reportModal());
      this.appLockService.isBiometricSupported().then((available) => {
        this.biometricAvailable.set(available);
      });
    });

    // Lock when app goes to background
    effect(() => {
      const handleVisibility = (): void => {
        if (document.hidden && this.authService.isAuthenticated()) {
          this.appLockService.lockNow();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      this.destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', handleVisibility),
      );
    });

    // Font scale is applied globally by FontScaleService via effect()
    // which sets document.documentElement.style.fontSize, adjusting base rem CSS rules.

    // Redirect to the lock screen when the app is locked
    effect(() => {
      const locked = this.appLockService.appLocked();
      const currentUrl = this.router.url;
      if (locked && !currentUrl.startsWith('/lock')) {
        void this.router.navigate(['/lock']);
      } else if (!locked && currentUrl.startsWith('/lock')) {
        void this.router.navigate(['/home']);
      }
    });

    effect(() => {
      const revision = this.centrifugeService.connectionRevision();
      if (!this.unreadSyncActive || revision <= this.handledConnectionRevision) return;
      this.handledConnectionRevision = revision;
      void this.requestUnreadRefresh();
    });
  }

  async ngOnInit(): Promise<void> {
    // Font scale and base rem sizing are handled globally by FontScaleService.
    // Block the app immediately if the installed version is deprecated.
    void this.versionService.checkVersion();

    // Subscribe to personal user notification channel for direct virtual gifts
    const user = this.authService.currentUser();
    const token = this.authService.getAccessToken();

    if (user && token) {
      await Promise.allSettled([
        this.economyStore.loadInitialData(),
        this.safetyService.loadBlockedUsers(),
      ]);

      // Check for daily login reward
      try {
        const checkIn = await this.economyStore.claimDailyCheckIn();
        if (checkIn?.claimed) {
          this.dailyRewardCoins.set(checkIn.coins_rewarded);
          this.showDailyRewardModal.set(true);
        }
      } catch {
        console.warn('Daily check-in was unavailable during application startup');
      }

      try {
        await this.centrifugeService.connect();
        this.centrifugeService.subscribe(`user_${user.id}`, (data: unknown) => {
          if (!isRecord(data)) return;
          const eventType = typeof data['type'] === 'string' ? data['type'] : null;

          if (eventType === 'virtual_gift') {
            const giftName = typeof data['gift_name'] === 'string' ? data['gift_name'] : 'Gift';
            const giftIcon = typeof data['icon'] === 'string' ? data['icon'] : '🎁';
            const giftId = typeof data['gift_id'] === 'string' ? data['gift_id'] : 'unknown';
            const costCoins = typeof data['coin_value'] === 'number' ? data['coin_value'] : 0;
            const animationType =
              typeof data['animation_type'] === 'string' ? data['animation_type'] : 'float';
            const animationUrl =
              typeof data['animation_url'] === 'string' && data['animation_url'].length > 0
                ? data['animation_url']
                : undefined;
            const senderName =
              typeof data['sender_name'] === 'string' ? data['sender_name'] : 'Language Partner';

            this.economyStore.triggerGiftAnimation({
              gift: {
                id: giftId,
                name: giftName,
                icon: giftIcon,
                cost_coins: costCoins,
                animation_type: animationType,
                animationUrl,
              },
              sender_name: senderName,
              receiver_name: 'You',
            });
          }

          // Handle incoming call events
          if (eventType === 'incoming_call') {
            const callerId = typeof data['callerId'] === 'string' ? data['callerId'] : '';
            const callerName = typeof data['callerName'] === 'string' ? data['callerName'] : '';
            const callerAvatarUrl =
              typeof data['callerAvatarUrl'] === 'string' ? data['callerAvatarUrl'] : undefined;
            const roomName = typeof data['roomName'] === 'string' ? data['roomName'] : '';
            const isVideoCall =
              typeof data['isVideoCall'] === 'boolean' ? data['isVideoCall'] : false;
            this.incomingCallData.set({
              callerId,
              callerName,
              callerAvatarUrl,
              roomName,
              isVideoCall,
            });
          }

          // Update unread counters for real-time chat messages
          if (eventType === 'unread_count_changed') {
            const tab = data['tab'];
            if (
              tab === 'chat' ||
              tab === 'moments' ||
              tab === 'discovery' ||
              tab === 'audioRooms' ||
              tab === 'profile'
            ) {
              void this.requestUnreadRefresh();
            }
          } else if (eventType === 'incoming_call') {
            this.unreadCounter.increment('audioRooms');
          }
        });

        this.unreadSyncActive = true;
        this.handledConnectionRevision = this.centrifugeService.connectionRevision();
        await this.requestUnreadRefresh();
      } catch {
        console.warn('Personal realtime updates were unavailable during application startup');
        this.unreadSyncActive = true;
        await this.requestUnreadRefresh();
      }

      // Request notification permission after user is authenticated
      await this.fcmService.requestPermissionAndGetToken();
      await this.fcmService.persistFcmToken(user.id);
    }
  }

  private requestUnreadRefresh(): Promise<void> {
    this.unreadRefreshRequested = true;
    if (this.unreadRefreshPromise) return this.unreadRefreshPromise;

    this.unreadRefreshPromise = this.refreshUnreadUntilCurrent().finally(() => {
      this.unreadRefreshPromise = null;
    });
    return this.unreadRefreshPromise;
  }

  private async refreshUnreadUntilCurrent(): Promise<void> {
    while (this.unreadRefreshRequested) {
      this.unreadRefreshRequested = false;
      await this.loadAuthoritativeUnreadCounts();
    }
  }

  private async loadAuthoritativeUnreadCounts(): Promise<void> {
    const [notifications, chat] = await Promise.allSettled([
      this.notificationService.getUnreadCount(),
      this.chatService.getUnreadCount(),
    ]);

    if (notifications.status === 'fulfilled') {
      this.unreadCounter.set('moments', notifications.value.byTab.moments);
      this.unreadCounter.set('discovery', notifications.value.byTab.discovery);
      this.unreadCounter.set('profile', notifications.value.byTab.profile);
    } else {
      console.warn('Notification unread count could not be loaded');
    }

    if (chat.status === 'fulfilled') {
      this.unreadCounter.set('chat', chat.value);
    } else {
      console.warn('Chat unread count could not be loaded');
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isValidPayload(data: unknown): data is {
    type: string;
    sender_name?: string;
    callerId?: string;
    callerName?: string;
    callerAvatarUrl?: string;
    roomName?: string;
    isVideoCall?: boolean;
  } {
    if (!this.isRecord(data)) {
      return false;
    }
    const type = data['type'];
    if (typeof type === 'string') {
      return true;
    }
    return false;
  }

  private isIncomingCallPayload(payload: unknown): payload is IncomingCallData {
    if (!this.isRecord(payload)) {
      return false;
    }
    return (
      typeof payload['callerId'] === 'string' &&
      typeof payload['callerName'] === 'string' &&
      typeof payload['callerAvatarUrl'] === 'string' &&
      typeof payload['roomName'] === 'string' &&
      typeof payload['isVideoCall'] === 'boolean'
    );
  }

  onAcceptCall(callData: IncomingCallData): void {
    this.incomingCallData.set(null);
    this.unreadCounter.decrement('audioRooms');

    if (callData.isVideoCall) {
      void this.router.navigate(['/video-call'], {
        queryParams: {
          roomName: callData.roomName,
          otherUserId: callData.callerId,
          otherUserName: callData.callerName,
          currentUserId: this.authService.currentUser()?.id || '',
        },
      });
    } else {
      void this.router.navigate(['/active-call'], {
        queryParams: {
          roomName: callData.roomName,
          callerName: callData.callerName,
          callerAvatar: callData.callerAvatarUrl || '',
          callDirection: 'incoming',
        },
      });
    }
  }

  onDeclineCall(callData: IncomingCallData): void {
    this.incomingCallData.set(null);
    this.unreadCounter.decrement('audioRooms');
    this.centrifugeService.publish(`user_${callData.callerId}`, {
      type: 'call_rejected',
      data: {
        userId: this.authService.currentUser()?.id,
        roomName: callData.roomName,
      },
    });
  }

  async toggleBiometricLock(): Promise<void> {
    if (this.biometricBusy()) return;
    this.biometricBusy.set(true);
    try {
      if (this.appLockService.biometricEnabled()) {
        await this.appLockService.disableBiometricLock();
      } else {
        await this.appLockService.enableBiometricLock();
      }
    } finally {
      this.biometricBusy.set(false);
    }
  }
}
