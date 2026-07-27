import { Component, inject, OnInit, signal, viewChild, afterNextRender } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore, VirtualGift } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { FcmService } from './services/fcm.service';
import { SafetyService } from './services/safety.service';
import { TranslatePipe } from './services/translate.pipe';
import { IncomingCallModalComponent, IncomingCallData } from './components/incoming-call-modal/incoming-call-modal.component';
import { ToastComponent } from './components/primitives/toast/toast.component';
import { ReportUserModalComponent } from './components/report-user-modal/report-user-modal.component';
import { ReportUserModalService } from './components/report-user-modal/report-user-modal.service';
import { DailyLoginModalComponent } from './components/daily-login-modal/daily-login-modal.component';
import { UnreadCounterService } from './services/unread-counter.service';
import { VersionCheckService } from './services/version-check.service';

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
    DailyLoginModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);
  fcmService = inject(FcmService);
  private safetyService = inject(SafetyService);
  reportModalService = inject(ReportUserModalService);
  unreadCounter = inject(UnreadCounterService);
  private versionCheckService = inject(VersionCheckService);

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
    }
  }

  onAcceptCall(callData: IncomingCallData): void {
    // Navigate to the call room or start the call
    console.log('Call accepted:', callData.roomName);
    this.incomingCallData.set(null);
    // TODO: Navigate to call room or start LiveKit session
  }

  onDeclineCall(callData: IncomingCallData): void {
    // Notify the caller that the call was declined
    console.log('Call declined:', callData.callerName);
    this.incomingCallData.set(null);
    // TODO: Send decline notification via Centrifugo
  }
}
