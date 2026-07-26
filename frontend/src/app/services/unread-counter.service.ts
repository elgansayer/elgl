import { Injectable, signal, computed, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UnreadCounterService {
  // Signals for specific unread categories
  readonly chatUnread = signal<number>(0);
  readonly notificationUnread = signal<number>(0);

  // Computed total for the app badge
  readonly totalUnread = computed(() => this.chatUnread() + this.notificationUnread());

  constructor() {
    // Automatically update the PWA app badge whenever the total changes
    effect(() => {
      this.updateAppBadge(this.totalUnread());
    });
  }

  setChatUnread(count: number): void {
    this.chatUnread.set(Math.max(0, count));
  }

  setNotificationUnread(count: number): void {
    this.notificationUnread.set(Math.max(0, count));
  }

  incrementChatUnread(): void {
    this.chatUnread.update(c => c + 1);
  }

  decrementChatUnread(): void {
    this.chatUnread.update(c => Math.max(0, c - 1));
  }

  incrementNotificationUnread(): void {
    this.notificationUnread.update(c => c + 1);
  }

  decrementNotificationUnread(): void {
    this.notificationUnread.update(c => Math.max(0, c - 1));
  }

  private updateAppBadge(count: number): void {
    if (typeof navigator !== 'undefined') {
      if (count > 0 && 'setAppBadge' in navigator) {
        (navigator as unknown as { setAppBadge: (c: number) => Promise<void> }).setAppBadge(count).catch((error: unknown) => {
          console.error('Failed to set app badge:', error);
        });
      } else if (count === 0 && 'clearAppBadge' in navigator) {
        (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge().catch((error: unknown) => {
          console.error('Failed to clear app badge:', error);
        });
      }
    }
  }
}
