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