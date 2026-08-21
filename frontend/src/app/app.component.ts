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
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FcmService } from './services/fcm.service';
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
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionCheckService } from './services/version-check.service';
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
import { TourService } from './services/tour.service';
import { NotificationService } from './services/notification.service';
import { ChatService } from './services/chat.service';
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
    RouterLinkActive,
    TranslatePipe,
    IncomingCallModalComponent,
    ToastComponent,
    ReportUserModalComponent,
    DailyLoginModalComponent,
    ConfirmDialogComponent,
    ThemeSelectorComponent,
    FontScaleSliderComponent,
    AppLanguageSelectorComponent,
    GiftAnimationOverlayComponent,
    ForcedUpdateModalComponent,
    NoNetworkBannerComponent,
    DesktopSidebarComponent,
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
  fcmService = inject(FcmService);
  private safetyService = inject(SafetyService);
  reportModalService = inject(ReportUserModalService);
  readonly unreadCounter = inject(UnreadCounterService);
  readonly versionCheckService = inject(VersionCheckService);
  private fontScaleService = inject(FontScaleService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  readonly appLockService = inject(AppLockService);
  private readonly router = inject(Router);
  private notificationService = inject(NotificationService);
  private chatService = inject(ChatService);

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
  }

  async ngOnInit(): Promise<void> {
    // Font scale and base rem sizing are handled globally by FontScaleService.
    // Block the app immediately if the installed version is deprecated.
    this.versionCheckService.checkVersion();

    // Subscribe to personal user notification channel for direct virtual gifts
    const user = this.authService.currentUser();
    const token = this.authService.getAccessToken();

    if (user && token) {
      await this.economyStore.loadInitialData();

      // Load the blocked user list once the user is available
      await this.safetyService.loadBlockedUsers();

      // Check for daily login reward
      const checkIn = await this.economyStore.claimDailyCheckIn();
      if (checkIn?.claimed) {
        this.dailyRewardCoins.set(checkIn.coins_rewarded);
        this.showDailyRewardModal.set(true);
      }

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
        if (eventType === 'new_message') {
          this.unreadCounter.incrementChatUnread();
        }

        // Update unread counters for real-time notifications
        if (
          eventType === 'follow' ||
          eventType === 'like_profile' ||
          eventType === 'like_moment' ||
          eventType === 'comment_moment' ||
          eventType === 'profile_visit' ||
          eventType === 'system'
        ) {
          this.unreadCounter.incrementNotificationUnread();
        }
      });

      // Load initial unread counts from backend
      await this.loadInitialUnreadCounts();

      // Request notification permission after user is authenticated
      await this.fcmService.requestPermission();
      await this.fcmService.persistFcmToken(user.id);
    }
  }

  private async loadInitialUnreadCounts(): Promise<void> {
    try {
      const [notificationCount] = await Promise.all([this.notificationService.getUnreadCount()]);
      this.unreadCounter.setNotificationUnread(notificationCount);
    } catch {
      // Silently ignore - real-time events will update counts
    }

    // Load chat unread counts from backend
    try {
      const rooms = await this.chatService.getRooms();
      let totalChatUnread = 0;
      for (const room of rooms) {
        try {
          const messages = await this.chatService.getMessages(room.id);
          const currentUserId = this.authService.currentUser()?.id;
          totalChatUnread += messages.filter(
            (m) => !m.is_read && m.sender_id !== currentUserId,
          ).length;
        } catch {
          // Skip rooms with errors
        }
      }
      this.unreadCounter.setChatUnread(totalChatUnread);
    } catch {
      // Silently ignore - real-time events will update counts
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
