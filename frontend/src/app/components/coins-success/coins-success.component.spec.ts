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
    expect(componentHtml).not.toMatch(/\bleft-\d/);
    expect(componentHtml).not.toMatch(/\bright-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should transition to confirmed view when checkout confirmation succeeds', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockStore.confirmCoinPurchase).toHaveBeenCalledWith('stripe_test_session');
    expect(component.status()).toBe('confirmed');
    expect(fixture.nativeElement.textContent).toContain('coinsSuccess.title');
    expect(fixture.nativeElement.textContent).toContain('coinsSuccess.message');
    expect(fixture.nativeElement.textContent).not.toContain('coinsSuccess.pending');
  });

  it('should render the pending checkout state as an announced status', () => {
    component.status.set('pending');
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('coinsSuccess.pending');
  });

  it('should render the failed checkout state without changing the dashboard action', () => {
    component.status.set('failed');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const decorativeEmoji = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(text).toContain('coinsSuccess.failureTitle');
    expect(text).toContain('coinsSuccess.failureMessage');
    expect(decorativeEmoji.textContent).toContain('😕');
    expect(button.textContent).toContain('coinsSuccess.dashboardBtn');
  });

  it('should fail without calling the store when session_id is missing', async () => {
    fixture.destroy();
    mockStore.confirmCoinPurchase.mockClear();
    Object.assign(TestBed.inject(ActivatedRoute), {
      queryParams: of({}),
      snapshot: { queryParams: {} },
    });

    const missingSessionFixture = TestBed.createComponent(CoinsSuccessComponent);
    missingSessionFixture.detectChanges();
    await missingSessionFixture.whenStable();
    missingSessionFixture.detectChanges();

    expect(mockStore.confirmCoinPurchase).not.toHaveBeenCalled();
    expect(missingSessionFixture.componentInstance.status()).toBe('failed');
    expect(missingSessionFixture.nativeElement.textContent).toContain('coinsSuccess.failureMessage');

    missingSessionFixture.destroy();
  });

  it('should render failure when the store cannot confirm the checkout session', async () => {
    fixture.destroy();
    mockStore.confirmCoinPurchase.mockResolvedValue(false);

    const failedFixture = TestBed.createComponent(CoinsSuccessComponent);
    failedFixture.detectChanges();
    await failedFixture.whenStable();
    failedFixture.detectChanges();

    expect(mockStore.confirmCoinPurchase).toHaveBeenLastCalledWith('stripe_test_session');
    expect(failedFixture.componentInstance.status()).toBe('failed');
    expect(failedFixture.nativeElement.textContent).toContain('coinsSuccess.failureTitle');

    failedFixture.destroy();
  });

  it('should keep the dashboard action Spartan-owned, keyboard-safe and touch-sized', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('size')).toBe('touch');
    expect(button.hasAttribute('hlmbtn')).toBe(true);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('should navigate to the dashboard when the dashboard action is activated', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    button.click();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
