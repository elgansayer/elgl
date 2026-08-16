import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { NotificationService, InAppNotification } from '../../services/notification.service';
import { UnreadCounterService } from '../../services/unread-counter.service';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';

export type NotificationTab = 'all' | 'likes' | 'comments' | 'follows' | 'system';

@Component({
  selector: 'app-notifications-inbox',
  imports: [HlmButton, TranslatePipe, ScrollablePillsComponent],
  templateUrl: './notifications-inbox.component.html',
  styleUrls: ['./notifications-inbox.component.scss'],
})
export class NotificationsInboxComponent {
  private notificationService = inject(NotificationService);
  private unreadCounter = inject(UnreadCounterService);
  private location = inject(Location);
  private router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly selectedTab = signal<NotificationTab>('all');
  readonly unreadCount = signal<number>(0);

  readonly notificationsResource = resource({
    params: () => this.selectedTab(),
    loader: ({ params: tab }) => this.loadNotifications(tab),
  });

  readonly notifications = computed(() => this.notificationsResource.value() ?? []);

  readonly isLoading = this.notificationsResource.isLoading;

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('notifications.tabAll') },
      { id: 'likes', label: this.i18n.translate('notifications.tabLikes') },
      { id: 'comments', label: this.i18n.translate('notifications.tabComments') },
      { id: 'follows', label: this.i18n.translate('notifications.tabFollows') },
      { id: 'system', label: this.i18n.translate('notifications.tabSystem') },
    ];
  });

  private async loadNotifications(tab: NotificationTab): Promise<InAppNotification[]> {
    const [list, unread] = await Promise.all([
      this.notificationService.getNotifications(tab),
      this.notificationService.getUnreadCount(),
    ]);
    this.unreadCount.set(unread);
    this.unreadCounter.setNotificationUnread(unread);
    return list;
  }

  goBack(): void {
    this.location.back();
  }

  setTab(tab: NotificationTab): void {
    this.selectedTab.set(tab);
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead();
    this.unreadCount.set(0);
    this.unreadCounter.setNotificationUnread(0);
  }

  async onNotificationClick(notif: InAppNotification): Promise<void> {
    if (!notif.is_read) {
      notif.is_read = true;
      this.unreadCount.update((c) => Math.max(0, c - 1));
      this.unreadCounter.decrementNotificationUnread();
      void this.notificationService.markAsRead(notif.id);
    }

    if (
      notif.type === 'like_moment' ||
      notif.type === 'comment_moment' ||
      notif.type === 'reply_comment' ||
      notif.type === 'mention_comment'
    ) {
      void this.router.navigate(['/moments']);
    } else if (notif.type === 'mention_chat') {
      void this.router.navigate(['/chat', notif.entity_id]);
    } else if (notif.type === 'system') {
      void this.router.navigate(['/help']);
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
      case 'mention_comment':
        return '💬';
      case 'mention_chat':
        return '📣';
      case 'follow':
        return '👤';
      case 'profile_visit':
        return '👁️';
      case 'system':
        return '🔔';
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
      case 'mention_comment':
        return 'notifications.mentionedInComment';
      case 'mention_chat':
        return 'notifications.mentionedInChat';
      case 'follow':
        return 'notifications.followedYou';
      case 'profile_visit':
        return 'notifications.viewedProfile';
      case 'system':
        return 'notifications.systemAlert';
      default:
        return 'notifications.newActivity';
    }
  }
}
