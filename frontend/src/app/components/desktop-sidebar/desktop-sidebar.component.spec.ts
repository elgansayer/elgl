import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { DesktopSidebarComponent } from './desktop-sidebar.component';
import { I18nService } from '../../services/i18n.service';
import { UnreadCounterService } from '../../services/unread-counter.service';

@Component({ template: '' })
class EmptyRouteComponent {}

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

class MockUnreadCounterService {
  tabCount(): number {
    return 0;
  }
}

describe('DesktopSidebarComponent', () => {
  let fixture: ComponentFixture<DesktopSidebarComponent>;
  let component: DesktopSidebarComponent;
  let router: Router;

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
