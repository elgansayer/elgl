import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { DesktopSidebarComponent } from './desktop-sidebar.component';
import { I18nService } from '../../services/i18n.service';
import { NavTab, UnreadCounterService } from '../../services/unread-counter.service';

@Component({ template: '' })
class EmptyRouteComponent {}

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

class MockUnreadCounterService {
  private readonly counts = new Map<NavTab, number>();

  tabCount(tab: NavTab): number {
    return this.counts.get(tab) ?? 0;
  }

  setCount(tab: NavTab, count: number): void {
    this.counts.set(tab, count);
  }

  reset(): void {
    this.counts.clear();
  }
}

describe('DesktopSidebarComponent', () => {
  let fixture: ComponentFixture<DesktopSidebarComponent>;
  let component: DesktopSidebarComponent;
  let router: Router;
  let unreadCounter: MockUnreadCounterService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesktopSidebarComponent, JoyrideModule.forRoot()],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: UnreadCounterService, useClass: MockUnreadCounterService },
        provideRouter([
          { path: '', component: EmptyRouteComponent },
          { path: 'chat', component: EmptyRouteComponent },
          { path: 'moments', component: EmptyRouteComponent },
          { path: 'shop', component: EmptyRouteComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DesktopSidebarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    unreadCounter = TestBed.inject(UnreadCounterService) as unknown as MockUnreadCounterService;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all nine navigation links', () => {
    const links = fixture.nativeElement.querySelectorAll('nav a');
    expect(links.length).toBe(9);
  });

  it('should render a labelled navigation landmark', () => {
    const nav: HTMLElement | null = fixture.nativeElement.querySelector('nav[role="navigation"]');
    expect(nav).toBeTruthy();
    expect(nav?.matches('[aria-label="nav.mainNav"]')).toBe(true);
  });

  it('should preserve native link semantics and visible focus treatment', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');

    for (const link of links) {
      expect(link.matches('[role]')).toBe(false);
      expect(link.matches('[tabindex]')).toBe(false);
      expect(link.classList.toString().includes('focus-visible:ring-2')).toBe(true);
      expect(link.classList.toString().includes('focus-visible:ring-primary')).toBe(true);
    }
  });

  it('should expose the active primary route with aria-current="page"', async () => {
    await router.navigateByUrl('/chat');
    await fixture.whenStable();
    fixture.detectChanges();

    const chatLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/chat"]');
    const momentsLink: HTMLAnchorElement =
      fixture.nativeElement.querySelector('a[href="/moments"]');

    expect(chatLink.matches('[aria-current="page"]')).toBe(true);
    expect(momentsLink.matches('[aria-current]')).toBe(false);
  });

  it('should expose the active economy route with aria-current="page"', async () => {
    await router.navigateByUrl('/shop');
    await fixture.whenStable();
    fixture.detectChanges();

    const shopLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/shop"]');
    const chatLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/chat"]');

    expect(shopLink.matches('[aria-current="page"]')).toBe(true);
    expect(chatLink.matches('[aria-current]')).toBe(false);
  });

  it('should bind every primary navigation tab to its own unread counter', () => {
    const cases: Array<{ tab: NavTab; path: string; count: number; expected: string }> = [
      { tab: 'chat', path: '/chat', count: 1, expected: '1' },
      { tab: 'moments', path: '/moments', count: 12, expected: '12' },
      { tab: 'discovery', path: '/discovery', count: 23, expected: '23' },
      { tab: 'audioRooms', path: '/audio-rooms', count: 34, expected: '34' },
      { tab: 'profile', path: '/profile', count: 45, expected: '45' },
    ];

    for (const testCase of cases) {
      unreadCounter.reset();
      unreadCounter.setCount(testCase.tab, testCase.count);
      fixture.detectChanges();

      const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
        `a[href="${testCase.path}"]`,
      );
      const badge: HTMLElement | null = link.querySelector('span.ms-auto');
      const allBadges: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('span.ms-auto');

      expect(badge?.textContent?.trim() === testCase.expected).toBe(true);
      expect(allBadges.length).toBe(1);
    }
  });

  it('should cap unread badge text at 99+ without changing the underlying count', () => {
    unreadCounter.setCount('chat', 100);
    fixture.detectChanges();

    const chatLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/chat"]');
    const badge: HTMLElement | null = chatLink.querySelector('span.ms-auto');

    expect(badge?.textContent?.trim() === '99+').toBe(true);
    expect(unreadCounter.tabCount('chat')).toBe(100);
  });

  it('should remove a navigation badge when the tab has no unread items', () => {
    unreadCounter.setCount('moments', 7);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/moments"] span.ms-auto'),
    ).toBeTruthy();

    unreadCounter.setCount('moments', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/moments"] span.ms-auto')).toBeNull();
  });
});
