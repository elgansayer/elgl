import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { UnreadCounterService } from '../../services/unread-counter.service';

@Component({
  selector: 'app-desktop-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, JoyrideModule],
  templateUrl: './desktop-sidebar.component.html',
})
export class DesktopSidebarComponent {
  readonly unreadCounter = inject(UnreadCounterService);

  readonly navItems = [
    { path: '/chat', icon: '💬', key: 'nav.helloTalk', exact: false },
    { path: '/moments', icon: '⭕', key: 'nav.moments', exact: false },
    { path: '/discovery', icon: '🌍', key: 'nav.connect', exact: false },
    { path: '/audio-rooms', icon: '🎙️', key: 'nav.liveRooms', exact: false },
    { path: '/profile', icon: '👤', key: 'nav.profile', exact: false },
  ];
}