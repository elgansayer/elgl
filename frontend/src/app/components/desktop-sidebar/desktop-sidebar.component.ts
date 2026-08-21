import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { UnreadCounterService, NavTab } from '../../services/unread-counter.service';

@Component({
  selector: 'app-desktop-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, JoyrideModule],
  templateUrl: './desktop-sidebar.component.html',
})
export class DesktopSidebarComponent {
  readonly unreadCounter = inject(UnreadCounterService);

  readonly navItems: { path: string; icon: string; key: string; exact: boolean; tab: NavTab }[] = [
    { path: '/chat', icon: '💬', key: 'nav.helloTalk', exact: false, tab: 'chat' },
    { path: '/moments', icon: '⭕', key: 'nav.moments', exact: false, tab: 'moments' },
    { path: '/discovery', icon: '🌍', key: 'nav.connect', exact: false, tab: 'discovery' },
    { path: '/audio-rooms', icon: '🎙️', key: 'nav.liveRooms', exact: false, tab: 'audioRooms' },
    { path: '/profile', icon: '👤', key: 'nav.profile', exact: false, tab: 'profile' },
  ];
}