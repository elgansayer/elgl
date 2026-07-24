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
  imports: [CommonModule, TranslatePipe, ScrollablePillsComponent],
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

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('notifications.tabAll') },
      { id: 'likes', label: this.i18n.translate('notifications.tabLikes') },
      { id: 'comments', label: this.i18n.translate('notifications.tabComments') },
      { id: 'follows', label: this.i18n.translate('notifications.tabFollows') },
    ];
  });

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

    if (
      notif.type === 'like_moment' ||
      notif.type === 'comment_moment' ||
      notif.type === 'reply_comment'
    ) {
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
      case 'reply_comment':
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
      case 'reply_comment':
        return 'notifications.repliedComment';
      case 'follow':
        return 'notifications.followedYou';
      case 'profile_visit':
        return 'notifications.viewedProfile';
      default:
        return 'notifications.newActivity';
    }
  }
}
