import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore, VirtualGift } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { TranslatePipe } from './services/translate.pipe';
import { IncomingCallModalComponent, IncomingCallData } from './components/incoming-call-modal/incoming-call-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive, 
    TranslatePipe, 
    IncomingCallModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);

  // Incoming call state
  readonly incomingCallData = signal<IncomingCallData | null>(null);

  async ngOnInit(): Promise<void> {
    await this.economyStore.loadInitialData();

    // Subscribe to personal user notification channel for direct virtual gifts
    const user = this.authService.currentUser();
    if (user) {
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
