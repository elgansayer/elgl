import { Component, computed, inject, OnInit, signal, viewChild, afterNextRender, effect, DestroyRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore, VirtualGift } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FcmService } from './services/fcm.service';
import { SafetyService } from './services/safety.service';
import { TranslatePipe } from './services/translate.pipe';
import { routeAnimations } from './animations/route.animations';
import { DOCUMENT } from '@angular/common';
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
import { ThemeSelectorComponent } from './components/theme-selector/theme-selector.component';
import { FontScaleSliderComponent } from './components/font-scale-slider/font-scale-slider.component';
import { FontScaleService } from './services/font-scale.service';
import { I18nService } from './services/i18n.service';
import { AppLanguageSelectorComponent } from './components/app-language-selector/app-language-selector.component';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isVirtualGift(v: unknown): v is VirtualGift {
  return isRecord(v) && 'id' in v && 'name' in v && 'icon' in v;
}

@Component({
  selector: 'app-root',
  imports: [
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
  ],
  templateUrl: './app.component.html',
  host: {
    '[class.app-locked]': 'authService.appLocked()',
  },
  styleUrls: ['./app.component.scss'],
  animations: [routeAnimations],
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';

  public startProductTour(): void {
    // Placeholder method for the interactive product tour feature.
  }
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);
  fcmService = inject(FcmService);
  private safetyService = inject(SafetyService);
  reportModalService = inject(ReportUserModalService);
  readonly unreadCounter = inject(UnreadCounterService);
  private versionCheckService = inject(VersionCheckService);
  private fontScaleService = inject(FontScaleService);
  readonly i18n = inject(I18nService);
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  readonly totalUnread = computed(() => this.unreadCounter.totalUnread());
  readonly hasUnread = computed(() => this.totalUnread() > 0);

  readonly unreadDisplayValue = computed(() =>
    this.totalUnread() > 99 ? '99+' : String(this.totalUnread()),
  );

  private routerOutlet = viewChild.required(RouterOutlet);

  protected prepareRoute(): string {
    const outlet = this.routerOutlet();
    if (!outlet?.activatedRoute) {
      return 'default';
    }
    const url = outlet.activatedRoute.snapshot.url.join('/');
    return url || 'root';
  }

  // Incoming call state
  readonly incomingCallData = signal<IncomingCallData | null>(null);
  // Biometric lock state
  readonly biometricAvailable = signal<boolean>(false);
  readonly biometricBusy = signal<boolean>(false);
  readonly biometricLockEnabled = computed(() => this.authService.biometricLockEnabled());
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
      this.authService.isBiometricSupported().then((available) => {
        this.biometricAvailable.set(available);
      });
    });

    // Lock when app goes to background
    effect(() => {
      const doc = this.document;
      const handleVisibility = (): void => {
        if (doc.hidden && this.authService.isAuthenticated()) {
          this.authService.lockApp();
        }
      };
      doc.addEventListener('visibilitychange', handleVisibility);
      this.destroyRef.onDestroy(() => doc.removeEventListener('visibilitychange', handleVisibility));
    });

    // Apply font scale to the root rem unit
    effect(() => {
      const scale = this.fontScaleService.scaleFactor();
      if (this.document && this.document.documentElement) {
        this.document.documentElement.style.fontSize = `${(scale * 16).toFixed(2)}px`;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Font scale and base rem sizing are handled globally by FontScaleService.
    // Block the app immediately if the installed version is deprecated.
    await this.versionCheckService.checkVersion();

    await this.economyStore.loadInitialData();

    // Subscribe to personal user notification channel for direct virtual gifts
    const user = this.authService.currentUser();
    if (user) {
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

        if (eventType === 'virtual_gift' && isVirtualGift(data['gift'])) {
          this.economyStore.triggerGiftAnimation({
            gift: data['gift'],
            sender_name: typeof data['sender_name'] === 'string' ? data['sender_name'] : 'Language Partner',
            receiver_name: 'You',
          });
        }

        // Handle incoming call events
        if (eventType === 'incoming_call') {
          const callerId = typeof data['callerId'] === 'string' ? data['callerId'] : '';
          const callerName = typeof data['callerName'] === 'string' ? data['callerName'] : '';
          const callerAvatarUrl = typeof data['callerAvatarUrl'] === 'string' ? data['callerAvatarUrl'] : undefined;
          const roomName = typeof data['roomName'] === 'string' ? data['roomName'] : '';
          const isVideoCall = typeof data['isVideoCall'] === 'boolean' ? data['isVideoCall'] : false;
          this.incomingCallData.set({
            callerId,
            callerName,
            callerAvatarUrl,
            roomName,
            isVideoCall,
          });
        }
      });

      // Request notification permission after user is authenticated
      await this.fcmService.requestPermission();
      await this.fcmService.persistFcmToken(user.id);
    }
  }

  onAcceptCall(_callData: IncomingCallData): void {
    this.incomingCallData.set(null);
    // TODO: Navigate to call room or start LiveKit session
  }

  onDeclineCall(_callData: IncomingCallData): void {
    this.incomingCallData.set(null);
    // TODO: Send decline notification via Centrifugo
  }

  async toggleBiometricLock(): Promise<void> {
    if (this.biometricBusy()) return;
    this.biometricBusy.set(true);
    try {
      if (this.authService.biometricLockEnabled()) {
        await this.authService.disableBiometricLock();
      } else {
        await this.authService.enableBiometricLock();
      }
    } finally {
      this.biometricBusy.set(false);
    }
  }

}
