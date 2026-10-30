import { Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { DesktopSidebarComponent } from './desktop-sidebar.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { NavTab, UnreadCounterService } from '../../services/unread-counter.service';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';

@Component({ template: '' })
class EmptyRouteComponent {}

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

class MockUnreadCounterService {
  // Backed by signals - like the real service - so template reads via
  // tabCount() register as reactive dependencies and the zoneless fixture
  // re-renders when a test calls setCount().
  private readonly counts = new Map<NavTab, WritableSignal<number>>();

  private signalFor(tab: NavTab): WritableSignal<number> {
    let value = this.counts.get(tab);
    if (!value) {
      value = signal(0);
      this.counts.set(tab, value);
    }
    return value;
  }

  tabCount(tab: NavTab): number {
    return this.signalFor(tab)();
  }

  badgeText(tab: NavTab): string {
    const count = this.tabCount(tab);
    return count > 99 ? '99+' : String(count);
  }

  setCount(tab: NavTab, count: number): void {
    this.signalFor(tab).set(count);
  }

  // Reuses each tab's existing signal instance rather than discarding it -
  // the template's reactive subscription is tied to that specific signal
  // object, so replacing it with a fresh one on the next setCount() would
  // leave the template pointed at an orphaned signal that never updates.
  reset(): void {
    for (const value of this.counts.values()) {
      value.set(0);
    }
  }
}

describe('DesktopSidebarComponent', () => {
  let fixture: ComponentFixture<DesktopSidebarComponent>;
  let component: DesktopSidebarComponent;
  let router: Router;
  let unreadCounter: MockUnreadCounterService;
  let seriousLearnerEnabled: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    seriousLearnerEnabled = signal(false);

    await TestBed.configureTestingModule({
      imports: [DesktopSidebarComponent, JoyrideModule.forRoot()],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: UnreadCounterService, useClass: MockUnreadCounterService },
        {
          provide: SeriousLearnerModeService,
          useValue: { enabled: seriousLearnerEnabled },
        },
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

  it('should render all nine navigation links in ordinary mode', () => {
    const links = fixture.nativeElement.querySelectorAll('nav a');
    expect(links.length).toBe(9);
  });

  it('should remove the Moments entry when Serious Learner mode is enabled', () => {
    seriousLearnerEnabled.set(true);
    fixture.detectChanges();

    const momentsLink = fixture.nativeElement.querySelector('a[href="/moments"]');
    const chatLink = fixture.nativeElement.querySelector('a[href="/chat"]');

    expect(momentsLink).toBeNull();
    expect(chatLink).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('nav a').length).toBe(8);
  });

  it('should render a labelled navigation landmark', () => {
    const nav = fixture.nativeElement.querySelector('nav[role="navigation"]');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-label')).toBe('nav.mainNav');
  });

  it('should preserve native link semantics and visible focus treatment', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');

    for (const link of links) {
      expect(link.hasAttribute('role')).toBe(false);
      expect(link.hasAttribute('tabindex')).toBe(false);
      expect(link.classList.toString()).toContain('focus-visible:ring-2');
      expect(link.classList.toString()).toContain('focus-visible:ring-primary');
    }
  });

  it('should use Relay semantic surface and radius roles', () => {
    unreadCounter.setCount('chat', 3);
    fixture.detectChanges();

    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');
    const unreadBadge: HTMLElement = fixture.nativeElement.querySelector(
      'a[href="/chat"] .ms-auto',
    );

    expect(nav.classList.toString().includes('bg-surface-200')).toBe(true);
    expect(nav.classList.toString().includes('border-surface-100')).toBe(true);

    for (const link of links) {
      expect(link.classList.toString().includes('rounded-app')).toBe(true);
      expect(link.classList.toString().includes('rounded-xl')).toBe(false);
    }

    expect(unreadBadge).toBeTruthy();
    expect(unreadBadge.classList.toString().includes('bg-danger')).toBe(true);
    expect(unreadBadge.classList.toString().includes('text-on-fill')).toBe(true);
    expect(unreadBadge.classList.toString().includes('tabular-nums')).toBe(true);
    expect(unreadBadge.classList.toString().includes('rounded-pill')).toBe(true);
    expect(unreadBadge.classList.toString().includes('rounded-full')).toBe(false);
  });

  it('should preserve the intentional desktop-only responsive contract', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    const classes = nav.classList.toString();

    expect(classes.includes('hidden')).toBe(true);
    expect(classes.includes('lg:flex')).toBe(true);
    expect(classes.includes('md:flex')).toBe(false);
  });

  it('should use Relay semantic surface and radius roles', () => {
    unreadCounter.setCount('chat', 3);
    fixture.detectChanges();

    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');
    const unreadBadge: HTMLElement = fixture.nativeElement.querySelector(
      'a[href="/chat"] .ms-auto',
    );

    expect(nav.classList.toString().includes('bg-surface-200')).toBe(true);
    expect(nav.classList.toString().includes('border-surface-100')).toBe(true);

    for (const link of links) {
      expect(link.classList.toString().includes('rounded-app')).toBe(true);
      expect(link.classList.toString().includes('rounded-xl')).toBe(false);
    }

    expect(unreadBadge).toBeTruthy();
    expect(unreadBadge.classList.toString().includes('bg-danger')).toBe(true);
    expect(unreadBadge.classList.toString().includes('text-on-fill')).toBe(true);
    expect(unreadBadge.classList.toString().includes('tabular-nums')).toBe(true);
    expect(unreadBadge.classList.toString().includes('rounded-pill')).toBe(true);
    expect(unreadBadge.classList.toString().includes('rounded-full')).toBe(false);
  });

  it('should preserve the intentional desktop-only responsive contract', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    const classes = nav.classList.toString();

    expect(classes.includes('hidden')).toBe(true);
    expect(classes.includes('lg:flex')).toBe(true);
    expect(classes.includes('md:flex')).toBe(false);
  });

  it('should expose the active primary route with aria-current="page"', async () => {
    await router.navigateByUrl('/chat');
    await fixture.whenStable();
    fixture.detectChanges();

    const chatLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/chat"]');
    const momentsLink: HTMLAnchorElement =
      fixture.nativeElement.querySelector('a[href="/moments"]');

    expect(chatLink.getAttribute('aria-current')).toBe('page');
    expect(momentsLink.hasAttribute('aria-current')).toBe(false);
  });

  it('should expose the active economy route with aria-current="page"', async () => {
    await router.navigateByUrl('/shop');
    await fixture.whenStable();
    fixture.detectChanges();

    const shopLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/shop"]');
    const chatLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a[href="/chat"]');

    expect(shopLink.getAttribute('aria-current')).toBe('page');
    expect(chatLink.hasAttribute('aria-current')).toBe(false);
  });
});

// The suite above echoes translation keys, which cannot reveal an emoji baked into the copy itself.
// This suite renders the sidebar with the shipped English dictionary instead.
describe('DesktopSidebarComponent with the shipped English dictionary', () => {
  const EMOJI = /\p{Extended_Pictographic}/gu;

  let fixture: ComponentFixture<DesktopSidebarComponent>;
  let i18n: I18nService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [DesktopSidebarComponent, JoyrideModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: { getAccessToken: () => null } },
        { provide: UnreadCounterService, useClass: MockUnreadCounterService },
        { provide: SeriousLearnerModeService, useValue: { enabled: signal(false) } },
        provideRouter([{ path: '', component: EmptyRouteComponent }]),
      ],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    fixture = TestBed.createComponent(DesktopSidebarComponent);
    fixture.detectChanges();
  });

  function iconAndLabel(href: string): { icon: string; label: string } {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(`a[href="${href}"]`);
    const [icon, label] = Array.from(link.children);
    return { icon: icon.textContent.trim(), label: label.textContent.trim() };
  }

  it('draws exactly one emoji in every navigation link', () => {
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('nav a');

    expect(links.length).toBe(9);
    for (const link of links) {
      expect(link.textContent.match(EMOJI), link.getAttribute('href') ?? '').toHaveLength(1);
    }
  });

  it('pairs each primary icon with a text-only label', () => {
    for (const item of fixture.componentInstance.navItems()) {
      const { icon, label } = iconAndLabel(item.path);

      expect(icon).toBe(item.icon);
      expect(label).toBe(i18n.translate(item.key));
      expect(label.match(EMOJI), item.key).toBeNull();
    }

    expect(iconAndLabel('/chat').label).toBe('HelloTalk');
    expect(iconAndLabel('/discovery').label).toBe('Connect');
    expect(iconAndLabel('/audio-rooms').label).toBe('Live Rooms');
    expect(iconAndLabel('/profile').label).toBe('Me');
  });

  it('pairs the settings icon with a text-only label', () => {
    const { icon, label } = iconAndLabel('/settings');

    expect(icon.match(EMOJI)).toHaveLength(1);
    expect(label).toBe('Settings');
  });
});
