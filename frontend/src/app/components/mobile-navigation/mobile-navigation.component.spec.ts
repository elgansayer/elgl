import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';
import { NavTab, UnreadCounterService } from '../../services/unread-counter.service';
import { MobileNavigationComponent } from './mobile-navigation.component';

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

class MockUnreadCounterService {
  private readonly counts = new Map<NavTab, WritableSignal<number>>();

  private countFor(tab: NavTab): WritableSignal<number> {
    let count = this.counts.get(tab);
    if (!count) {
      count = signal(0);
      this.counts.set(tab, count);
    }
    return count;
  }

  tabCount(tab: NavTab): number {
    return this.countFor(tab)();
  }

  badgeText(tab: NavTab): string {
    const count = this.tabCount(tab);
    return count > 99 ? '99+' : String(count);
  }

  setCount(tab: NavTab, count: number): void {
    this.countFor(tab).set(count);
  }
}

describe('MobileNavigationComponent', () => {
  let fixture: ComponentFixture<MobileNavigationComponent>;
  let unreadCounter: MockUnreadCounterService;
  let seriousLearnerEnabled: WritableSignal<boolean>;

  beforeEach(async () => {
    seriousLearnerEnabled = signal(false);
    await TestBed.configureTestingModule({
      imports: [MobileNavigationComponent],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: UnreadCounterService, useClass: MockUnreadCounterService },
        {
          provide: SeriousLearnerModeService,
          useValue: { enabled: seriousLearnerEnabled },
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileNavigationComponent);
    unreadCounter = TestBed.inject(UnreadCounterService) as unknown as MockUnreadCounterService;
    await fixture.whenStable();
  });

  function primaryLinks(): NodeListOf<HTMLAnchorElement> {
    return fixture.nativeElement.querySelectorAll('nav a');
  }

  it('renders the five primary destinations in product order', () => {
    const links = Array.from(primaryLinks());

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/chat',
      '/moments',
      '/discovery',
      '/audio-rooms',
      '/profile',
    ]);
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'nav.mainNav',
    );
  });

  it('renders each tab badge from shared state and preserves the full accessible count', async () => {
    const counts: readonly [NavTab, number][] = [
      ['chat', 3],
      ['moments', 24],
      ['discovery', 100],
      ['audioRooms', 8],
      ['profile', 12],
    ];

    for (const [tab, count] of counts) {
      unreadCounter.setCount(tab, count);
    }
    await fixture.whenStable();

    const links = Array.from(primaryLinks());
    expect(
      links.map((link) =>
        link.querySelector('[aria-hidden="true"]:last-of-type')?.textContent.trim(),
      ),
    ).toEqual(['3', '24', '99+', '8', '12']);
    expect(links[2].getAttribute('aria-label')).toBe('nav.connect, 100 chatList.filterUnread');
  });

  it('omits zero-count badges without removing native link or focus semantics', () => {
    for (const link of primaryLinks()) {
      expect(link.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
      expect(link.hasAttribute('role')).toBe(false);
      expect(link.hasAttribute('tabindex')).toBe(false);
      expect(link.classList).toContain('focus-visible:ring-2');
    }
  });

  it('removes Moments in Serious Learner mode while retaining the other four tabs', async () => {
    seriousLearnerEnabled.set(true);
    await fixture.whenStable();

    expect(Array.from(primaryLinks()).map((link) => link.getAttribute('href'))).toEqual([
      '/chat',
      '/discovery',
      '/audio-rooms',
      '/profile',
    ]);
  });
});
