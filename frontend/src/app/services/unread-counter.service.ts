import { Injectable, signal, computed, effect } from '@angular/core';

/** Identifies a navigation tab for per-tab badge counts. */
export type NavTab = 'chat' | 'moments' | 'discovery' | 'audioRooms' | 'profile';
export type UnreadSnapshot = Readonly<Record<NavTab, number>>;

const MAX_VISIBLE_BADGE_COUNT = 99;

interface MutationRevision {
  increases: number;
  decreases: number;
}

type MutationRevisionSnapshot = Readonly<Record<NavTab, MutationRevision>>;

@Injectable({
  providedIn: 'root',
})
export class UnreadCounterService {
  readonly chatUnread = signal<number>(0);
  readonly momentsUnread = signal<number>(0);
  readonly discoveryUnread = signal<number>(0);
  readonly audioRoomsUnread = signal<number>(0);
  readonly notificationUnread = signal<number>(0);
  private readonly mutationRevisions: Record<NavTab, MutationRevision> = {
    chat: { increases: 0, decreases: 0 },
    moments: { increases: 0, decreases: 0 },
    discovery: { increases: 0, decreases: 0 },
    audioRooms: { increases: 0, decreases: 0 },
    profile: { increases: 0, decreases: 0 },
  };
  private readonly snapshotRevisions = new WeakMap<UnreadSnapshot, MutationRevisionSnapshot>();

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

  /**
   * Returns the current unread count for a given navigation tab.
   * Mirrors tabCount() for callers expecting a traditional getter.
   */
  get(tab: NavTab): number {
    return this.tabCount(tab);
  }

  // Generic helpers

  set(tab: NavTab, count: number): void {
    const value = this.normaliseCount(count);
    const current = this.tabCount(tab);
    if (value > current) {
      this.mutationRevisions[tab].increases += 1;
    } else if (value < current) {
      this.mutationRevisions[tab].decreases += 1;
    }
    this.signalFor(tab).set(value);
  }

  /** Alias for set() to support callers expecting setCount(). */
  setCount(tab: NavTab, count: number): void {
    this.set(tab, count);
  }

  snapshot(): UnreadSnapshot {
    const snapshot = {
      chat: this.chatUnread(),
      moments: this.momentsUnread(),
      discovery: this.discoveryUnread(),
      audioRooms: this.audioRoomsUnread(),
      profile: this.notificationUnread(),
    };
    this.snapshotRevisions.set(snapshot, this.copyMutationRevisions());
    return snapshot;
  }

  /** Reconciles an authoritative count without losing or duplicating a newer local change. */
  reconcile(tab: NavTab, authoritativeCount: number, snapshot: UnreadSnapshot): void {
    const currentCount = this.tabCount(tab);
    const baselineCount = snapshot[tab];
    const normalisedAuthoritativeCount = this.normaliseCount(authoritativeCount);
    const baselineRevision = this.snapshotRevisions.get(snapshot)?.[tab];
    const currentRevision = this.mutationRevisions[tab];
    const increased = baselineRevision
      ? currentRevision.increases > baselineRevision.increases
      : currentCount > baselineCount;
    const decreased = baselineRevision
      ? currentRevision.decreases > baselineRevision.decreases
      : currentCount < baselineCount;

    if (increased && decreased) {
      // The response can represent any intermediate point between conflicting
      // persisted changes. The final locally observed state is the only value
      // that cannot reapply or discard one of those changes.
      return;
    }
    if (increased) {
      this.set(tab, Math.max(currentCount, normalisedAuthoritativeCount));
    } else if (decreased) {
      this.set(tab, Math.min(currentCount, normalisedAuthoritativeCount));
    } else {
      this.set(tab, normalisedAuthoritativeCount);
    }
  }

  increment(tab: NavTab): void {
    this.set(tab, Math.min(Number.MAX_SAFE_INTEGER, this.tabCount(tab) + 1));
  }

  decrement(tab: NavTab): void {
    this.set(tab, Math.max(0, this.tabCount(tab) - 1));
  }

  /** Resets unread count for a given tab, or all tabs if tab is omitted. */
  reset(tab?: NavTab): void {
    if (tab) {
      this.set(tab, 0);
    } else {
      this.resetAll();
    }
  }

  resetAll(): void {
    this.set('chat', 0);
    this.set('moments', 0);
    this.set('discovery', 0);
    this.set('audioRooms', 0);
    this.set('profile', 0);
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

  private copyMutationRevisions(): MutationRevisionSnapshot {
    return {
      chat: { ...this.mutationRevisions.chat },
      moments: { ...this.mutationRevisions.moments },
      discovery: { ...this.mutationRevisions.discovery },
      audioRooms: { ...this.mutationRevisions.audioRooms },
      profile: { ...this.mutationRevisions.profile },
    };
  }

  private compactBadgeText(count: number): string {
    return count > MAX_VISIBLE_BADGE_COUNT ? `${MAX_VISIBLE_BADGE_COUNT}+` : String(count);
  }

  private updateAppBadge(count: number): void {
    if (typeof navigator === 'undefined') return;
    try {
      if (count > 0 && this.hasSetAppBadge(navigator)) {
        navigator.setAppBadge(count).catch(() => {
          // App Badging is best-effort and unsupported/blocked browsers are expected.
        });
      } else if (count === 0 && this.hasClearAppBadge(navigator)) {
        navigator.clearAppBadge().catch(() => {
          // App Badging is best-effort and unsupported/blocked browsers are expected.
        });
      }
    } catch {
      // Synchronous access or SecurityError on navigator.setAppBadge in restricted iframes
    }
  }

  private hasSetAppBadge(
    nav: Navigator,
  ): nav is Navigator & { setAppBadge: (count: number) => Promise<void> } {
    return 'setAppBadge' in nav && typeof nav.setAppBadge === 'function';
  }

  private hasClearAppBadge(
    nav: Navigator,
  ): nav is Navigator & { clearAppBadge: () => Promise<void> } {
    return 'clearAppBadge' in nav && typeof nav.clearAppBadge === 'function';
  }
}
