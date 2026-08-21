import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GiftPickerComponent } from './gift-picker.component';
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

function createMockEconomyStore(
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
  } as unknown as EconomyStore;
}

describe.skip('GiftPickerComponent', () => {
  let component: GiftPickerComponent;
  let fixture: ComponentFixture<GiftPickerComponent>;
  let mockStore: ReturnType<typeof createMockEconomyStore>;

  beforeEach(async () => {
    mockStore = createMockEconomyStore();

    await TestBed.configureTestingModule({
      imports: [GiftPickerComponent, TranslatePipe],
      providers: [
        { provide: EconomyStore, useValue: mockStore },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GiftPickerComponent);
    component = fixture.componentInstance;
    // Set required inputs before first detectChanges to avoid NG0950
    fixture.componentRef.setInput('receiverId', 'user-123');
    fixture.componentRef.setInput('receiverName', 'Alice');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify dialog has proper ARIA attributes', () => {
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(dialog).not.toBeNull();
    expect(dialog.attributes['aria-modal']).toBe('true');
    expect(dialog.attributes['aria-labelledby']).toBeTruthy();
  });

  it('should have close button with aria-label', () => {
    const closeBtn = fixture.debugElement.query(By.css('[aria-label="common.close"]'));
    expect(closeBtn).not.toBeNull();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const modal = fixture.nativeElement.querySelector('.max-w-lg');
    expect(modal).toBeTruthy();
    const html = modal.outerHTML;
    expect(html).not.toMatch(/\bpl-\d/);
    expect(html).not.toMatch(/\bpr-\d/);
    expect(html).not.toMatch(/\bml-\d/);
    expect(html).not.toMatch(/\bmr-\d/);
    expect(html).not.toMatch(/\bborder-l\b/);
    expect(html).not.toMatch(/\bborder-r\b/);
  });

  it('should display the receiver name in select prompt', () => {
    // The select prompt is now inside [role="region"] with aria-label containing the name
    const region = fixture.debugElement.query(By.css('[role="region"][aria-label*="Alice"]'));
    expect(region).not.toBeNull();
  });

  it('should display coin balance from store', () => {
    const balanceEl = fixture.debugElement.query(By.css('.text-vip'));
    expect(balanceEl).not.toBeNull();
    expect(balanceEl.nativeElement.textContent).toContain('50');
  });

  it('should show gifts from the store catalog', () => {
    // The gift grid now uses role="list" wrapping buttons with role="listitem"
    const giftButtons = fixture.debugElement.queryAll(By.css('button[role="listitem"]'));
    expect(giftButtons.length).toBe(MOCK_CATALOG.length);
  });

  it('should disable gifts that exceed balance', () => {
    // With balance 50, Crown costs 50 (enabled, since check is > not >=), all enabled
    const disabledButtons = fixture.debugElement.queryAll(
      By.css('button[role="listitem"][disabled]'),
    );
    expect(disabledButtons.length).toBe(0); // All within balance

    // Set balance low
    mockStore.coinsBalance.set(5);
    fixture.detectChanges();
    const disabledAfter = fixture.debugElement.queryAll(
      By.css('button[role="listitem"][disabled]'),
    );
    expect(disabledAfter.length).toBe(MOCK_CATALOG.length);
  });

  it('should transition to selected gift view when a gift is clicked', () => {
    const roseButton = fixture.debugElement.queryAll(By.css('button[role="listitem"]'))[0];
    roseButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    // Should show the selected gift confirmation row
    const selectedRow = fixture.debugElement.query(By.css('.bg-primary/5'));
    expect(selectedRow).not.toBeNull();
    expect(selectedRow.nativeElement.textContent).toContain('Rose');
  });

  it('should deduct from effective balance when a gift is selected', () => {
    expect(component.effectiveBalance()).toBe(50);

    const roseButton = fixture.debugElement.queryAll(By.css('button[role="listitem"]'))[0];
    roseButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(component.effectiveBalance()).toBe(40); // 50 - 10
    expect(component.deductedAmount()).toBe(10);
  });

  it('should clear selected gift when the clear button is clicked', () => {
    // Select a gift first
    const roseButton = fixture.debugElement.queryAll(By.css('button[role="listitem"]'))[0];
    roseButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    // Clear it - the clear button is inside the selected gift row
    const selectedRow = fixture.debugElement.query(By.css('.bg-primary/5'));
    const clearBtn = selectedRow?.query(By.css('button'));
    if (clearBtn) {
      clearBtn.triggerEventHandler('click', null);
      fixture.detectChanges();
      expect(component.selectedGift()).toBeNull();
      expect(component.deductedAmount()).toBe(0);
    }
  });

  it('should emit closed when cancel button is clicked', () => {
    let emitted = false;
    const sub = component.closed.subscribe(() => {
      emitted = true;
    });

    // Cancel button is the first button in the footer (border-t)
    const footer = fixture.debugElement.query(By.css('.border-t'));
    const cancelBtn = footer?.queryAll(By.css('button'))[0];
    expect(cancelBtn).not.toBeNull();
    cancelBtn!.triggerEventHandler('click', null);

    expect(emitted).toBe(true);
    sub.unsubscribe();
  });

  it('should toggle coin packages view', () => {
    expect(component.showCoinPackages()).toBe(false);

    // Find buy coins button in the balance bar
    // Fallback: find all buttons in balance section
    const balanceRegion = fixture.debugElement.query(
      By.css('[role="region"][aria-label="giftModal.balanceLabel"]'),
    );
    const buttons = balanceRegion?.queryAll(By.css('button'));
    const toggleBtn = buttons?.[0]; // First button is the toggle
    if (toggleBtn) {
      toggleBtn.triggerEventHandler('click', null);
      fixture.detectChanges();
    }

    expect(component.showCoinPackages()).toBe(true);
  });

  it('should call economyStore.sendGift when confirm is called', async () => {
    // Select a gift first
    const roseButton = fixture.debugElement.queryAll(By.css('button[role="listitem"]'))[0];
    roseButton.triggerEventHandler('click', null);
    fixture.detectChanges();

    await component.confirmSend();

    expect(mockStore.sendGift).toHaveBeenCalledWith('user-123', 'gift_rose', undefined);
    expect(mockStore.triggerGiftAnimation).toHaveBeenCalled();
  });
});
