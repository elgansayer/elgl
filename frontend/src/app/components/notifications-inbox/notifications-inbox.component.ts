import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  NotificationService,
  InAppNotification,
} from '../../services/notification.service';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';

export type NotificationTab = 'all' | 'likes' | 'comments' | 'follows';

@Component({
  selector: 'app-notifications-inbox',
  imports: [CommonModule, RouterLink, TranslatePipe, ScrollablePillsComponent],
  templateUrl: './notifications-inbox.component.html',
  styleUrls: ['./notifications-inbox.component.scss'],
})
export class NotificationsInboxComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private location = inject(Location);
  private router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly notifications = signal<InAppNotification[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly selectedTab = signal<NotificationTab>('all');
  readonly unreadCount = signal<number>(0);

  readonly filterPills = signal<{ id: NotificationTab; labelKey: string }[]>([
    { id: 'all', labelKey: 'notifications.tabAll' },
    { id: 'likes', labelKey: 'notifications.tabLikes' },
    { id: 'comments', labelKey: 'notifications.tabComments' },
    { id: 'follows', labelKey: 'notifications.tabFollows' },
  ]);

  async ngOnInit(): Promise<void> {
    await this.loadNotifications();
  }

  goBack(): void {
    this.location.back();
  }

  async setTab(tab: NotificationTab): Promise<void> {
    this.selectedTab.set(tab);
    await this.loadNotifications();
  }

  async loadNotifications(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [list, unread] = await Promise.all([
        this.notificationService.getNotifications(this.selectedTab()),
        this.notificationService.getUnreadCount(),
      ]);
      this.notifications.set(list);
      this.unreadCount.set(unread);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
    this.unreadCount.set(0);
    this.notifications.update((list) =>
      list.map((item) => ({ ...item, is_read: true }))
    );
  }

  async onNotificationClick(notif: InAppNotification): Promise<void> {
    if (!notif.is_read) {
      notif.is_read = true;
      this.unreadCount.update((c) => Math.max(0, c - 1));
      void this.notificationService.markAsRead(notif.id);
    }

    if (notif.type === 'like_moment' || notif.type === 'comment_moment') {
      void this.router.navigate(['/moments']);
    } else {
      void this.router.navigate(['/profile/user', notif.actor_id]);
    }
  }

  getBadgeIcon(type: string): string {
    switch (type) {
      case 'like_profile':
      case 'like_moment':
        return '❤️';
      case 'comment_moment':
        return '💬';
      case 'follow':
        return '👤';
      case 'profile_visit':
        return '👁️';
      default:
        return '🔔';
    }
  }

  getNotificationMessageKey(type: string): string {
    switch (type) {
      case 'like_profile':
        return 'notifications.likedProfile';
      case 'like_moment':
        return 'notifications.likedMoment';
      case 'comment_moment':
        return 'notifications.commentedMoment';
      case 'follow':
        return 'notifications.followedYou';
      case 'profile_visit':
        return 'notifications.viewedProfile';
      default:
        return 'notifications.newActivity';
    }
  }
}
