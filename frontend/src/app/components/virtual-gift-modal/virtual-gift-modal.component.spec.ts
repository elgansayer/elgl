import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VirtualGiftModalComponent } from './virtual-gift-modal.component';
import { EconomyStore, VirtualGift, CoinPackage } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

const MOCK_CATALOG: VirtualGift[] = [
  { id: 'gift_rose', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' },
  { id: 'gift_heart', name: 'Heart', icon: '❤️', cost_coins: 20, animation_type: 'float' },
  { id: 'gift_crown', name: 'Crown', icon: '👑', cost_coins: 50, animation_type: 'premium' },
];

const MOCK_PACKAGES: CoinPackage[] = [
  { id: 'coins_small', name: 'Small', coins: 100, price_ukp: 4, price_usd: 4.99 },
  { id: 'coins_medium', name: 'Medium', coins: 500, price_ukp: 16, price_usd: 19.99 },
];

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

function createMockStore(
  overrides: Partial<{
    coinsBalance: number;
    catalog: VirtualGift[];
    coinPackages: CoinPackage[];
  }> = {},
) {
  return {
    coinsBalance: signal(overrides.coinsBalance ?? 50),
    catalog: signal(overrides.catalog ?? MOCK_CATALOG),
    coinPackages: signal(overrides.coinPackages ?? MOCK_PACKAGES),
    loadInitialData: vi.fn().mockResolvedValue(undefined),
    loadCoinPackages: vi.fn().mockResolvedValue(undefined),
    buyCoins: vi.fn().mockResolvedValue(undefined),
    sendGift: vi.fn().mockResolvedValue(true),
    triggerGiftAnimation: vi.fn(),
  };
}

describe.skip('VirtualGiftModalComponent', () => {
  let component: VirtualGiftModalComponent;
  let fixture: ComponentFixture<VirtualGiftModalComponent>;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(async () => {
    mockStore = createMockStore();

    await TestBed.configureTestingModule({
      imports: [VirtualGiftModalComponent, TranslatePipe],
      providers: [
        { provide: EconomyStore, useValue: mockStore },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VirtualGiftModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('receiverId', 'user-123');
    fixture.componentRef.setInput('receiverName', 'Alice');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const modal = fixture.nativeElement.querySelector('.max-w-lg');
    expect(modal).toBeTruthy();
    // Verify logical properties are applied, not physical ones
    const html = modal.outerHTML;
    expect(html).not.toMatch(/\bpl-\d/);
    expect(html).not.toMatch(/\bpr-\d/);
    expect(html).not.toMatch(/\bml-\d/);
    expect(html).not.toMatch(/\bmr-\d/);
    expect(html).not.toMatch(/\bborder-l\b/);
    expect(html).not.toMatch(/\bborder-r\b/);
  });

  it('should display coin balance from store', () => {
    const balanceEl = fixture.nativeElement.textContent;
    expect(balanceEl).toContain('50');
  });

  it('should display the receiver name', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alice');
  });

  it('should show gift catalog grid', () => {
    const giftCards = fixture.nativeElement.querySelectorAll('.grid button');
    expect(giftCards.length).toBe(MOCK_CATALOG.length);
  });

  it('should select a gift on click and apply auto-deduction', () => {
    const giftButtons = fixture.nativeElement.querySelectorAll('.grid button');
    giftButtons[0].click();
    fixture.detectChanges();

    expect(component.selectedGift()).not.toBeNull();
    expect(component.selectedGift()!.id).toBe('gift_rose');
    expect(component.effectiveBalance()).toBe(40);
    expect(component.deductedAmount()).toBe(10);
  });

  it('should disable gifts exceeding effective balance', () => {
    mockStore.coinsBalance.set(5);
    fixture.detectChanges();

    const disabledButtons = fixture.nativeElement.querySelectorAll('.grid button[disabled]');
    expect(disabledButtons.length).toBe(MOCK_CATALOG.length);
  });

  it('should toggle coin packages view', () => {
    const buyBtn = fixture.nativeElement.querySelector('.bg-vip');
    buyBtn.click();
    fixture.detectChanges();

    expect(component.showCoinPackages()).toBe(true);
    expect(mockStore.loadCoinPackages).toHaveBeenCalled();
  });

  it('should call sendGift and trigger animation on confirm', async () => {
    component.selectGift(MOCK_CATALOG[0]);
    fixture.detectChanges();

    await component.confirmSend();

    expect(mockStore.sendGift).toHaveBeenCalledWith('user-123', 'gift_rose', undefined);
    expect(mockStore.triggerGiftAnimation).toHaveBeenCalled();
  });

  it('should not send if no gift selected', async () => {
    await component.confirmSend();
    expect(mockStore.sendGift).not.toHaveBeenCalled();
  });
});
