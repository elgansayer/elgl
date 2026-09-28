import { Injectable, signal, computed, effect } from '@angular/core';

/** Identifies a navigation tab for per-tab badge counts. */
export type NavTab = 'chat' | 'moments' | 'discovery' | 'audioRooms' | 'profile';

const MAX_VISIBLE_BADGE_COUNT = 99;

@Injectable({
  providedIn: 'root',
})
export class UnreadCounterService {
  readonly chatUnread = signal<number>(0);
  readonly momentsUnread = signal<number>(0);
  readonly discoveryUnread = signal<number>(0);
  readonly audioRoomsUnread = signal<number>(0);
  readonly notificationUnread = signal<number>(0);

  /** Per-tab lookup so navigation surfaces bind to one shared state owner. */
  readonly tabCount = (tab: NavTab): number => {
    switch (tab) {
      case 'chat':
        return this.chatUnread();
      case 'moments':
        return this.momentsUnread();
      case 'discovery':
        return this.discoveryUnread();
      case 'audioRooms':
        return this.audioRoomsUnread();
      case 'profile':
        return this.notificationUnread();
    }
  };

  /**
   * Aggregate count used by the application badge and top-level notification
   * indicator. Individual counters are already bounded, but the sum can still
   * exceed Number.MAX_SAFE_INTEGER, so saturate it before exposing it.
   */
  readonly totalUnread = computed(() =>
    Math.min(
      Number.MAX_SAFE_INTEGER,
      this.chatUnread() +
        this.momentsUnread() +
        this.discoveryUnread() +
        this.audioRoomsUnread() +
        this.notificationUnread(),
    ),
  );

  constructor() {
    effect(() => {
      this.updateAppBadge(this.totalUnread());
    });
  }

  /**
   * Returns the compact value rendered by navigation badges while preserving
   * the full counter value in service state for totals and later decrements.
   */
  badgeText(tab: NavTab): string {
    return this.compactBadgeText(this.tabCount(tab));
  }

  /** Compact aggregate badge text for application-wide notification surfaces. */
  totalBadgeText(): string {
    return this.compactBadgeText(this.totalUnread());
  }

  // Generic helpers

  set(tab: NavTab, count: number): void {
    this.signalFor(tab).set(this.normaliseCount(count));
  }

  increment(tab: NavTab): void {
    this.signalFor(tab).update((count) =>
      Math.min(Number.MAX_SAFE_INTEGER, this.normaliseCount(count) + 1),
    );
  }

  decrement(tab: NavTab): void {
    this.signalFor(tab).update((count) => Math.max(0, this.normaliseCount(count) - 1));
  }

  resetAll(): void {
    this.chatUnread.set(0);
    this.momentsUnread.set(0);
    this.discoveryUnread.set(0);
    this.audioRoomsUnread.set(0);
    this.notificationUnread.set(0);
  }

  // Legacy methods kept for backward compat

  setChatUnread(count: number): void {
    this.set('chat', count);
  }

  setNotificationUnread(count: number): void {
    this.set('profile', count);
  }

  incrementChatUnread(): void {
    this.increment('chat');
  }

  decrementChatUnread(): void {
    this.decrement('chat');
  }

  incrementNotificationUnread(): void {
    this.increment('profile');
  }

  decrementNotificationUnread(): void {
    this.decrement('profile');
  }

  // Private helpers

  private signalFor(tab: NavTab): ReturnType<typeof signal<number>> {
    const map: Record<NavTab, ReturnType<typeof signal<number>>> = {
      chat: this.chatUnread,
      moments: this.momentsUnread,
      discovery: this.discoveryUnread,
      audioRooms: this.audioRoomsUnread,
      profile: this.notificationUnread,
    };
    return map[tab];
  }

  private normaliseCount(count: number): number {
    if (!Number.isFinite(count) || count <= 0) {
      return 0;
    }

    return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(count));
  }

  private compactBadgeText(count: number): string {
    return count > MAX_VISIBLE_BADGE_COUNT ? `${MAX_VISIBLE_BADGE_COUNT}+` : String(count);
  }

  private updateAppBadge(count: number): void {
    if (typeof navigator === 'undefined') return;
    if (count > 0 && this.hasSetAppBadge(navigator)) {
      navigator.setAppBadge(count).catch(() => {
        // App Badging is best-effort and unsupported/blocked browsers are expected.
      });
    } else if (count === 0 && this.hasClearAppBadge(navigator)) {
      navigator.clearAppBadge().catch(() => {
        // App Badging is best-effort and unsupported/blocked browsers are expected.
      });
    }
  }

  private hasSetAppBadge(
    nav: Navigator,
  ): nav is Navigator & { setAppBadge: (count: number) => Promise<void> } {
    return typeof (nav as Navigator & { setAppBadge?: unknown }).setAppBadge === 'function';
  }

  private hasClearAppBadge(
    nav: Navigator,
  ): nav is Navigator & { clearAppBadge: () => Promise<void> } {
    return typeof (nav as Navigator & { clearAppBadge?: unknown }).clearAppBadge === 'function';
  }
}
