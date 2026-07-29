import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from './services/translate.pipe';
import { AuthService } from './services/auth.service';
import { CentrifugeService } from './services/centrifuge.service';
import { EconomyStore, VirtualGift } from './services/economy.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  authService = inject(AuthService);
  economyStore = inject(EconomyStore);
  centrifugeService = inject(CentrifugeService);
  private readonly router = inject(Router);

  readonly navItems = [
    { path: '/discovery', label: 'nav.partners', icon: '🔎' },
    { path: '/moments', label: 'nav.moments', icon: '📝' },
    { path: '/chat', label: 'nav.chats', icon: '💬' },
    { path: '/audio-rooms', label: 'nav.live', icon: '🎙️' },
    { path: '/profile', label: 'nav.me', icon: '👤' },
  ] as const;

  readonly currentRoute = signal(this.router.url);
  readonly routeTransitionTick = signal(0);

  async ngOnInit(): Promise<void> {
    await this.economyStore.loadInitialData();

    const user = this.authService.currentUser();
    if (user) {
      await this.centrifugeService.connect();
      this.centrifugeService.subscribe(`user_${user.id}`, (data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          'type' in data &&
          data.type === 'virtual_gift' &&
          'gift' in data
        ) {
          const payload = data as {
            gift: Partial<VirtualGift> & { icon: string; name: string; cost_coins: number };
            sender_name?: string;
            receiver_name?: string;
          };
          this.economyStore.triggerGiftAnimation({
            gift: {
              id: payload.gift.id || 'broadcast',
              name: payload.gift.name,
              icon: payload.gift.icon,
              cost_coins: payload.gift.cost_coins,
              animation_type: payload.gift.animation_type || 'pulse',
            },
            sender_name: payload.sender_name || 'Language Partner',
            receiver_name: payload.receiver_name || 'You',
          });
        }
      });
    }

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.currentRoute.set(this.router.url);
      this.routeTransitionTick.update((value) => value + 1);
    });
  }

  isRouteActive(path: string): boolean {
    return this.currentRoute().startsWith(path);
  }
}
