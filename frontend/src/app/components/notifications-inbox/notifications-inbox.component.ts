import { Location } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '../../services/i18n.service';
import {
  InAppNotification,
  NotificationFilter,
  NotificationService,
} from '../../services/notification.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { UnreadCounterService } from '../../services/unread-counter.service';
import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';

export type NotificationTab = NotificationFilter;

@Component({
  selector: 'app-notifications-inbox',
  imports: [HlmButton, TranslatePipe, ScrollablePillsComponent],
  templateUrl: './notifications-inbox.component.html',
  styleUrls: ['./notifications-inbox.component.scss'],
})
export class NotificationsInboxComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly unreadCounter = inject(UnreadCounterService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly pageSize = 20;

  readonly selectedTab = signal<NotificationTab>('all');
  readonly unreadCount = signal(0);
  readonly additionalNotifications = signal<InAppNotification[]>([]);
  readonly hasMore = signal(false);
  readonly isLoadingMore = signal(false);
  readonly markingAllRead = signal(false);
  readonly actionError = signal(false);
  readonly loadMoreError = signal(false);

  readonly notificationsResource = resource({
    params: () => this.selectedTab(),
    loader: ({ params: tab }) => this.loadNotifications(tab),
  });

  readonly notifications = computed(() => {
    const byId = new Map<string, InAppNotification>();
    for (const notification of this.notificationsResource.value() ?? []) {
      byId.set(notification.id, notification);
    }
    for (const notification of this.additionalNotifications()) {
      byId.set(notification.id, notification);
    }
    return [...byId.values()];
  });

  readonly isLoading = this.notificationsResource.isLoading;
  readonly loadError = this.notificationsResource.error;

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
    this.additionalNotifications.set([]);
    this.actionError.set(false);
    this.loadMoreError.set(false);
    const [list, unread] = await Promise.all([
      this.notificationService.getNotifications(tab, { limit: this.pageSize }),
      this.notificationService.getUnreadCount(),
    ]);
    this.unreadCount.set(unread);
    this.unreadCounter.setNotificationUnread(unread);
    this.hasMore.set(list.length === this.pageSize);
    return list;
  }

  goBack(): void {
    this.location.back();
  }

  setTab(tab: NotificationTab): void {
    if (tab === this.selectedTab()) return;
    this.additionalNotifications.set([]);
    this.hasMore.set(false);
    this.actionError.set(false);
    this.loadMoreError.set(false);
    this.selectedTab.set(tab);
  }

  retry(): void {
    this.actionError.set(false);
    this.loadMoreError.set(false);
    this.notificationsResource.reload();
  }

  async loadMore(): Promise<void> {
    if (!this.hasMore() || this.isLoadingMore()) return;
    const current = this.notifications();
    const before = current.at(-1)?.created_at;
    if (!before) {
      this.hasMore.set(false);
      return;
    }

    this.isLoadingMore.set(true);
    this.loadMoreError.set(false);
    try {
      const next = await this.notificationService.getNotifications(this.selectedTab(), {
        limit: this.pageSize,
        before,
      });
      this.additionalNotifications.update((items) => [...items, ...next]);
      this.hasMore.set(next.length === this.pageSize);
    } catch {
      this.loadMoreError.set(true);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  async markAllAsRead(): Promise<void> {
    if (this.markingAllRead() || this.unreadCount() === 0) return;
    this.markingAllRead.set(true);
    this.actionError.set(false);
    try {
      await this.notificationService.markAllAsRead();
      for (const notification of this.notifications()) notification.is_read = true;
      this.unreadCount.set(0);
      this.unreadCounter.setNotificationUnread(0);
    } catch {
      this.actionError.set(true);
    } finally {
      this.markingAllRead.set(false);
    }
  }

  onNotificationClick(notification: InAppNotification): void {
    if (!notification.is_read) void this.markNotificationRead(notification);

    if (
      notification.type === 'like_moment' ||
      notification.type === 'comment_moment' ||
      notification.type === 'reply_comment' ||
      notification.type === 'mention_comment'
    ) {
      void this.router.navigate(['/moments']);
    } else if (notification.type === 'mention_chat' && notification.entity_id) {
      void this.router.navigate(['/chat', notification.entity_id]);
    } else if (notification.type === 'system') {
      void this.router.navigate(['/help']);
    } else {
      void this.router.navigate(['/profile', notification.actor_id]);
    }
  }

  private async markNotificationRead(notification: InAppNotification): Promise<void> {
    try {
      await this.notificationService.markAsRead(notification.id);
      if (notification.is_read) return;
      notification.is_read = true;
      this.unreadCount.update((count) => Math.max(0, count - 1));
      this.unreadCounter.decrementNotificationUnread();
    } catch {
      this.actionError.set(true);
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
