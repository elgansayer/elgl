import { Component, inject, OnInit } from '@angular/core';

import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { EconomyStore, VirtualGift } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';
import { TranslatePipe } from './services/translate.pipe';
import { LanguageSelectorComponent } from './components/language-selector/language-selector.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageSelectorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
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
      this.centrifugeService.subscribe(`user_${user.id}`, (data: unknown) => {
        const payload = data as { type?: string; gift?: VirtualGift; sender_name?: string } | null;
        if (payload && payload.type === 'virtual_gift' && payload.gift) {
          this.economyStore.triggerGiftAnimation({
            gift: payload.gift,
            sender_name: payload.sender_name || 'Language Partner',
            receiver_name: 'You',
          });
        }
      });
    }
  }
}
