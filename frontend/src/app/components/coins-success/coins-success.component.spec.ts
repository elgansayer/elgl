import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
        { provide: I18nService, useClass: MockI18nService },
        { provide: EconomyStore, useValue: mockStore },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ session_id: 'stripe_test_session' }),
            snapshot: { queryParams: { session_id: 'stripe_test_session' } },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
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

  it('exposes a labelled main landmark and live status region', () => {
    const main = fixture.nativeElement.querySelector('main');
    const title = fixture.nativeElement.querySelector('#coins-success-title');
    const status = fixture.nativeElement.querySelector('#coins-success-status');

    expect(main).toBeTruthy();
    expect(title).toBeTruthy();
    expect(status).toBeTruthy();
    expect(main.getAttribute('aria-labelledby')).toBe('coins-success-title');
    expect(main.getAttribute('aria-describedby')).toBe('coins-success-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('keeps deterministic native keyboard and touch semantics for the dashboard action', () => {
    const interactiveElements = fixture.nativeElement.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const dashboardButton = fixture.nativeElement.querySelector('button');

    expect(interactiveElements).toHaveLength(1);
    expect(dashboardButton).toBeTruthy();
    expect(dashboardButton.getAttribute('type')).toBe('button');
    expect(dashboardButton.textContent).toContain('coinsSuccess.dashboardBtn');
  });

  it('keeps the page reflow-safe instead of clipping content at high zoom', () => {
    const main = fixture.nativeElement.querySelector('main');
    const content = fixture.nativeElement.querySelector('main > div');

    expect(main.classList.contains('min-h-screen')).toBe(true);
    expect(main.classList.contains('h-screen')).toBe(false);
    expect(main.classList.contains('overflow-hidden')).toBe(false);
    expect(content.classList.contains('w-full')).toBe(true);
    expect(content.classList.contains('max-w-md')).toBe(true);
  });

  it('should transition to confirmed view when confirmed', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    // With session_id present and confirmCoinPurchase resolving to true,
    // status should transition to 'confirmed'
    expect(text).toContain('coinsSuccess.title');
    expect(text).not.toContain('coinsSuccess.pending');
  });
});
