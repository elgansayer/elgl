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
import { JoyrideModule, JoyrideService } from 'ngx-joyride';
import { I18nService } from './services/i18n.service';

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
    JoyrideModule,
  ],
  template: `
    @if (authService.appLocked()) {
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
        (click)="authService.unlockApp()"
      >
        <div class="text-center text-white">
          <p class="mb-4 text-lg font-medium">{{ 'app_lock.title' | t }}</p>
          <p class="mb-6 text-sm opacity-70">{{ 'app_lock.subtitle' | t }}</p>
          <button
            class="rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold shadow-xl hover:bg-indigo-500"
            (click)="authService.unlockApp()"
          >
            {{ 'app_lock.unlock_btn' | t }}
          </button>
        </div>
      </div>
    }
    <router-outlet />
    <app-toast />
    <app-incoming-call-modal
      [callData]="incomingCallData()"
      (accept)="onAcceptCall($event)"
      (decline)="onDeclineCall($event)"
    />
    <app-report-user-modal #reportModal />
    <app-daily-login-modal
      [show]="showDailyRewardModal()"
      [coinsRewarded]="dailyRewardCoins()"
      (close)="showDailyRewardModal.set(false)"
    />
    <app-confirm-dialog />
    <app-theme-selector />
    @if (fontScaleService.isOpen()) {
      <app-font-scale-slider
        [scale]="fontScaleService.currentScale()"
        (scaleChange)="fontScaleService.setScale($event)"
      />
    }
  `,
  host: {
    '[class.app-locked]': 'authService.appLocked()',
  },
  styleUrls: ['./app.component.scss'],
  animations: [routeAnimations],
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);
  fcmService = inject(FcmService);
  private safetyService = inject(SafetyService);
  reportModalService = inject(ReportUserModalService);
  readonly unreadCounter = inject(UnreadCounterService);
  private versionCheckService = inject(VersionCheckService);
  readonly fontScaleService = inject(FontScaleService);
  private joyrideService = inject(JoyrideService);
  private i18n = inject(I18nService);
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  readonly totalUnread = computed(() => this.unreadCounter.totalUnread());

  readonly unreadDisplayValue = computed(() =>
    this.totalUnread() > 99 ? '99+' : String(this.totalUnread()),
  );

  private routerOutlet = viewChild.required(RouterOutlet);
  readonly authService = inject(AuthService);

  protected prepareRoute(): string {
    return this.routerOutlet()?.activatedRouteData?.['animation'] ?? 'default';
  }

  // Incoming call state
  readonly incomingCallData = signal<IncomingCallData | null>(null);

  // Daily reward state
  readonly dailyRewardCoins = signal<number>(0);
  readonly showDailyRewardModal = signal<boolean>(false);

  readonly reportModal = viewChild.required<ReportUserModalComponent>('reportModal');

  constructor() {
    afterNextRender(() => {
      this.reportModalService.registerModal(this.reportModal());
    });

    // Lock when app goes to background
    effect(() => {
      const doc = this.document;
      const handleVisibility = (): void => {
        if (doc.hidden && this.authService.isAuthenticated()) {
          this.authService.appLocked.set(true);
        }
      };
      doc.addEventListener('visibilitychange', handleVisibility);
      this.destroyRef.onDestroy(() => doc.removeEventListener('visibilitychange', handleVisibility));
    });
  }

  async ngOnInit(): Promise<void> {
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
        const payload = data as { type?: string; gift?: VirtualGift; sender_name?: string } | null;
        if (payload && payload.type === 'virtual_gift' && payload.gift) {
          this.economyStore.triggerGiftAnimation({
            gift: payload.gift,
            sender_name: payload.sender_name || 'Language Partner',
            receiver_name: 'You',
          });
        }

        // Handle incoming call events
        if (payload && payload.type === 'incoming_call') {
          const callPayload = payload as IncomingCallData & { type: string };
          this.incomingCallData.set({
            callerId: callPayload.callerId,
            callerName: callPayload.callerName,
            callerAvatarUrl: callPayload.callerAvatarUrl,
            roomName: callPayload.roomName,
            isVideoCall: callPayload.isVideoCall,
          });
        }
      });

      // Request notification permission after user is authenticated
      await this.fcmService.requestPermission();
      await this.fcmService.persistFcmToken(user.id);

      // Start onboarding tour for brand new users
      if (!localStorage.getItem('onboarding_done')) {
        setTimeout(() => {
          this.joyrideService.startTour({
            steps: [
              { id: 'step-chat', title: this.i18n.translate('joyride.chat.title'), text: this.i18n.translate('joyride.chat.text') },
              { id: 'step-moments', title: this.i18n.translate('joyride.moments.title'), text: this.i18n.translate('joyride.moments.text') },
              { id: 'step-discovery', title: this.i18n.translate('joyride.discovery.title'), text: this.i18n.translate('joyride.discovery.text') },
              { id: 'step-audio-rooms', title: this.i18n.translate('joyride.audioRooms.title'), text: this.i18n.translate('joyride.audioRooms.text') },
              { id: 'step-profile', title: this.i18n.translate('joyride.profile.title'), text: this.i18n.translate('joyride.profile.text') },
            ],
            stepDefaultPosition: 'bottom',
          }).then(() => {
            localStorage.setItem('onboarding_done', 'true');
          });
        }, 1500);
      }
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
}
