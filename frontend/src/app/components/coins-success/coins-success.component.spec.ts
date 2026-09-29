import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CoinsSuccessComponent } from './coins-success.component';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  translate(key: string, params?: Record<string, unknown>): string {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return key;
  }
}

class MockEconomyStore {
  coinsBalance = signal(50);
  confirmCoinPurchase = vi.fn().mockResolvedValue(true);
}

describe('CoinsSuccessComponent', () => {
  let component: CoinsSuccessComponent;
  let fixture: ComponentFixture<CoinsSuccessComponent>;
  let mockStore: MockEconomyStore;

  beforeEach(async () => {
    mockStore = new MockEconomyStore();

    await TestBed.configureTestingModule({
      imports: [CoinsSuccessComponent, TranslatePipe],
      providers: [
        provideRouter([]),
        { provide: I18nService, useClass: MockI18nService },
        { provide: EconomyStore, useValue: mockStore },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ session_id: 'stripe_test_session' }),
            snapshot: { queryParams: { session_id: 'stripe_test_session' } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CoinsSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should use Relay semantic surface, radius, and elevation tokens', () => {
    const page = fixture.nativeElement.firstElementChild as HTMLElement;
    const panel = page.firstElementChild as HTMLElement;

    expect([...page.classList]).toEqual(expect.arrayContaining(['bg-surface-500']));
    expect([...panel.classList]).toEqual(
      expect.arrayContaining([
        'bg-surface-200',
        'border-surface-100',
        'rounded-card',
        'shadow-card',
        'text-center',
      ]),
    );
    expect(panel.className).not.toMatch(
      /\b(?:bg|text|border)-(?:black|white|slate|gray|red|blue|green|amber|purple|pink)(?:-|\b)/,
    );
  });

  it('should use mobile-first spacing with wider breakpoint refinements', () => {
    const page = fixture.nativeElement.firstElementChild as HTMLElement;
    const panel = page.firstElementChild as HTMLElement;
    const dashboardLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a');

    expect([...page.classList]).toEqual(
      expect.arrayContaining(['px-4', 'py-6', 'sm:px-6', 'sm:py-10', 'lg:px-8']),
    );
    expect([...panel.classList]).toEqual(
      expect.arrayContaining(['px-5', 'py-8', 'sm:px-8', 'sm:py-10', 'lg:px-10', 'lg:py-12']),
    );
    expect([...dashboardLink.classList]).toEqual(expect.arrayContaining(['w-full', 'sm:w-auto']));
  });

  it('should transition to confirmed view when confirmed', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('coinsSuccess.title');
    expect(text).not.toContain('coinsSuccess.pending');
  });

  it('should use a native Spartan navigation link for the coin dashboard action', () => {
    const dashboardLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a');

    expect(dashboardLink).toBeTruthy();
    expect(dashboardLink.getAttribute('href')).toBe('/coin-economy');
    expect(dashboardLink.getAttribute('size')).toBe('touch');
    expect(dashboardLink.hasAttribute('role')).toBe(false);
    expect(dashboardLink.hasAttribute('tabindex')).toBe(false);
    dashboardLink.focus();
    expect(document.activeElement).toBe(dashboardLink);
  });
});
