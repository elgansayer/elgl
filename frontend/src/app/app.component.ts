import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'HelloTalk Clone';
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);

  async ngOnInit(): Promise<void> {
    await this.economyStore.loadInitialData();

    // Subscribe to personal user notification channel for direct virtual gifts
    const user = this.authService.currentUser();
    if (user) {
      await this.centrifugeService.connect();
      this.centrifugeService.subscribe(`user_${user.id}`, (data: any) => {
        if (data && data.type === 'virtual_gift') {
          this.economyStore.triggerGiftAnimation({
            gift: data.gift,
            sender_name: data.sender_name || 'Language Partner',
            receiver_name: 'You'
          });
        }
      });
    }
  }
}
