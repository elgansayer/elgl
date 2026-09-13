import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GiftPickerComponent } from './gift-picker.component';
import { CoinPackage, EconomyStore, VirtualGift } from '../../services/economy.store';
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
    if (!params) return key;
    return Object.entries(params).reduce(
      (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
      key,
    );
  }
}

function createMockEconomyStore(
  overrides: Partial<{
    coinsBalance: number;
    catalog: VirtualGift[];
    coinPackages: CoinPackage[];
    isOnline: boolean;
  }> = {},
) {
  return {
    coinsBalance: signal(overrides.coinsBalance ?? 50),
    catalog: signal(overrides.catalog ?? MOCK_CATALOG),
    coinPackages: signal(overrides.coinPackages ?? MOCK_PACKAGES),
    isOnline: signal(overrides.isOnline ?? true),
    loadCoinPackages: vi.fn().mockResolvedValue(undefined),
    buyCoins: vi.fn().mockResolvedValue(undefined),
    sendGift: vi.fn().mockResolvedValue(true),
    triggerGiftAnimation: vi.fn(),
  };
}

describe('GiftPickerComponent', () => {
  let component: GiftPickerComponent;
  let fixture: ComponentFixture<GiftPickerComponent>;
  let mockStore: ReturnType<typeof createMockEconomyStore>;

  beforeEach(async () => {
    mockStore = createMockEconomyStore();

    await TestBed.configureTestingModule({
      imports: [GiftPickerComponent],
      providers: [
        { provide: EconomyStore, useValue: mockStore as unknown as EconomyStore },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GiftPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('receiverId', 'user-123');
    fixture.componentRef.setInput('receiverName', 'Alice');
    fixture.componentRef.setInput('roomId', 'room-456');
    fixture.detectChanges();
  });

  it('renders an accessible gift choice group using the live server balance', () => {
    expect(component.effectiveBalance()).toBe(50);

    const radios = fixture.debugElement.queryAll(By.css('button[role="radio"]'));
    expect(radios).toHaveLength(MOCK_CATALOG.length);
    expect(radios.every((radio) => radio.attributes['aria-label'])).toBe(true);
  });

  it('normalises malformed balances instead of exposing spendable phantom coins', () => {
    mockStore.coinsBalance.set(-5);
    expect(component.effectiveBalance()).toBe(0);

    mockStore.coinsBalance.set(Number.POSITIVE_INFINITY);
    expect(component.effectiveBalance()).toBe(0);

    mockStore.coinsBalance.set(12.9);
    expect(component.effectiveBalance()).toBe(12);
  });

  it('selects only gifts that are affordable while online', () => {
    component.selectGift(MOCK_CATALOG[0]);
    expect(component.selectedGift()?.id).toBe('gift_rose');

    component.clearSelection();
    mockStore.coinsBalance.set(5);
    component.selectGift(MOCK_CATALOG[0]);
    expect(component.selectedGift()).toBeNull();

    mockStore.coinsBalance.set(50);
    mockStore.isOnline.set(false);
    component.selectGift(MOCK_CATALOG[0]);
    expect(component.selectedGift()).toBeNull();
  });

  it('does not optimistically deduct coins before the server confirms the gift', () => {
    component.selectGift(MOCK_CATALOG[0]);

    expect(component.effectiveBalance()).toBe(50);
    expect(mockStore.coinsBalance()).toBe(50);
  });

  it('sends the selected gift once, then animates and closes after confirmation', async () => {
    component.selectGift(MOCK_CATALOG[0]);
    const closed = vi.fn();
    component.closed.subscribe(closed);

    await component.confirmSend();

    expect(mockStore.sendGift).toHaveBeenCalledTimes(1);
    expect(mockStore.sendGift).toHaveBeenCalledWith('user-123', 'gift_rose', 'room-456');
    expect(mockStore.triggerGiftAnimation).toHaveBeenCalledWith({
      gift: MOCK_CATALOG[0],
      sender_name: 'You',
      receiver_name: 'Alice',
    });
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent send attempts', async () => {
    let resolveSend!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveSend = resolve;
    });
    vi.mocked(mockStore.sendGift).mockReturnValueOnce(pending);
    component.selectGift(MOCK_CATALOG[0]);

    const first = component.confirmSend();
    const second = component.confirmSend();

    expect(mockStore.sendGift).toHaveBeenCalledTimes(1);
    resolveSend(true);
    await Promise.all([first, second]);
  });

  it('keeps the selection retryable when the server rejects the send', async () => {
    vi.mocked(mockStore.sendGift).mockResolvedValueOnce(false);
    component.selectGift(MOCK_CATALOG[0]);
    const closed = vi.fn();
    component.closed.subscribe(closed);

    await component.confirmSend();

    expect(component.selectedGift()?.id).toBe('gift_rose');
    expect(mockStore.triggerGiftAnimation).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
  });

  it('fails closed if connectivity or balance changes after selection', async () => {
    component.selectGift(MOCK_CATALOG[2]);
    expect(component.canSendSelectedGift()).toBe(true);

    mockStore.coinsBalance.set(20);
    expect(component.canSendSelectedGift()).toBe(false);
    await component.confirmSend();
    expect(mockStore.sendGift).not.toHaveBeenCalled();

    mockStore.coinsBalance.set(50);
    mockStore.isOnline.set(false);
    expect(component.canSendSelectedGift()).toBe(false);
    await component.confirmSend();
    expect(mockStore.sendGift).not.toHaveBeenCalled();
  });

  it('does not start purchases or load packages while offline', () => {
    mockStore.isOnline.set(false);

    component.toggleCoinPackages();
    component.buyCoins('coins_small');

    expect(component.showCoinPackages()).toBe(false);
    expect(mockStore.loadCoinPackages).not.toHaveBeenCalled();
    expect(mockStore.buyCoins).not.toHaveBeenCalled();
  });

  it('loads coin packages lazily when the online purchase view is opened', () => {
    mockStore.coinPackages.set([]);

    component.toggleCoinPackages();

    expect(component.showCoinPackages()).toBe(true);
    expect(mockStore.loadCoinPackages).toHaveBeenCalledTimes(1);
  });

  it('does not emit a dialog-close event while a spend is in flight', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);
    component.isSending.set(true);

    component.onDialogStateChanged('closed');

    expect(closed).not.toHaveBeenCalled();
  });
});
