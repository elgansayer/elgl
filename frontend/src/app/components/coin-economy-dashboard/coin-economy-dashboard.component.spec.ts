import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, Component, input } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoinEconomyDashboardComponent } from './coin-economy-dashboard.component';
import { EconomyStore, TransactionRecord, VirtualGift, StickerPack } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';
import { CoinEconomyOnboardingService } from '../../services/coin-economy-onboarding.service';
import { JoyrideService } from 'ngx-joyride';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

@Component({ selector: 'app-card', template: '<ng-content />' })
class MockCardComponent {
  readonly variant = input<string>('default');
  readonly padding = input<string>('md');
  readonly customClass = input<string>('');
}

@Component({ selector: 'app-pill', template: '<ng-content />' })
class MockPillComponent {}

@Component({ selector: 'app-button-primary', template: '<ng-content />' })
class MockButtonPrimaryComponent {}

@Component({ selector: 'app-skeleton-loader', template: '' })
class MockSkeletonLoaderComponent {
  readonly height = input<string>('16px');
  readonly width = input<string>('100%');
  readonly borderRadius = input<string>('8px');
  readonly variant = input<string>('rect');
  readonly customClass = input<string>('');
}

@Component({ selector: 'app-empty-state', template: '' })
class MockEmptyStateComponent {
  readonly icon = input<string>('');
  readonly title = input<string>('');
  readonly description = input<string>('');
  readonly actionLabel = input<string>('');
  readonly customClass = input<string>('');
}

describe('CoinEconomyDashboardComponent', () => {
  let component: CoinEconomyDashboardComponent;
  let fixture: ComponentFixture<CoinEconomyDashboardComponent>;
  let economyStoreMock: {
    coinsBalance: ReturnType<typeof vi.fn>;
    stickerPacks: ReturnType<typeof vi.fn>;
    catalog: ReturnType<typeof vi.fn>;
    recentTransactions: ReturnType<typeof vi.fn>;
    isLoading: ReturnType<typeof vi.fn>;
    hasLoadedOnce: ReturnType<typeof vi.fn>;
    isOnline: ReturnType<typeof vi.fn>;
    loadInitialData: ReturnType<typeof vi.fn>;
    claimDailyCheckIn: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    economyStoreMock = {
      coinsBalance: vi.fn().mockReturnValue(150),
      stickerPacks: vi.fn().mockReturnValue([] as StickerPack[]),
      catalog: vi.fn().mockReturnValue([] as VirtualGift[]),
      recentTransactions: vi.fn().mockReturnValue([] as TransactionRecord[]),
      isLoading: vi.fn().mockReturnValue(false),
      hasLoadedOnce: vi.fn().mockReturnValue(true),
      isOnline: vi.fn().mockReturnValue(true),
      loadInitialData: vi.fn().mockResolvedValue(undefined),
      claimDailyCheckIn: vi.fn().mockResolvedValue({
        claimed: true,
        coins_rewarded: 10,
        new_balance: 160,
      }),
    };

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        DecimalPipe,
        { provide: EconomyStore, useValue: economyStoreMock },
        { provide: I18nService, useValue: {
          translate: (key: string) => key,
          currentLocale: vi.fn().mockReturnValue('en'),
          isRtl: vi.fn().mockReturnValue(false),
        }},
        { provide: CoinEconomyOnboardingService, useValue: {
          isCompleted: () => true,
          isTourInProgress: vi.fn().mockReturnValue(false),
          reset: vi.fn(),
          stepNames: ['coinEconomyStepBalance'],
          markComplete: vi.fn(),
        }},
        { provide: JoyrideService, useValue: {
          startTour: () => ({ subscribe: vi.fn() }),
        }},
      ],
    })
      .overrideComponent(CoinEconomyDashboardComponent, {
        set: {
          template: '<div class="test-host"><h1>Dashboard</h1><p class="text-3xl font-extrabold text-amber-400">{{ balance() | number }}</p><button class="rounded-full bg-amber-500/20 px-4 py-2" (click)="claimDailyReward()">Daily Check-in</button></div>',
          imports: [
            DecimalPipe,
            MockTranslatePipe,
            MockCardComponent,
            MockPillComponent,
            MockButtonPrimaryComponent,
            MockSkeletonLoaderComponent,
            MockEmptyStateComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CoinEconomyDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display the coin balance', () => {
    fixture.detectChanges();
    const balanceEl: HTMLElement | null = fixture.nativeElement.querySelector('.text-3xl.font-extrabold.text-amber-400');
    expect(balanceEl?.textContent?.trim()).toBe('150');
  });

  it('should render a dashboard title', () => {
    fixture.detectChanges();
    const h1: HTMLElement | null = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Dashboard');
  });

  it('should call loadInitialData on init', () => {
    fixture.detectChanges();
    expect(economyStoreMock.loadInitialData).toHaveBeenCalled();
  });

  it('should expose the economy store', () => {
    expect(component.economyStore).toBeDefined();
    expect(component.balance()).toBe(150);
  });

  it('should getTransactionTypeLabel for gift_sent', () => {
    expect(component.getTransactionTypeLabel('gift_sent')).toBeDefined();
  });

  it('should getTransactionTypeLabel for daily_checkin', () => {
    expect(component.getTransactionTypeLabel('daily_checkin')).toBeDefined();
  });

  it('should claimDailyReward call store claimDailyCheckIn', async () => {
    fixture.detectChanges();
    await component.claimDailyReward();
    expect(economyStoreMock.claimDailyCheckIn).toHaveBeenCalled();
  });

  it('should startTour call onboarding reset', () => {
    fixture.detectChanges();
    const onboarding = fixture.debugElement.injector.get(CoinEconomyOnboardingService);
    const resetSpy = vi.spyOn(onboarding, 'reset');
    component.startTour();
    expect(resetSpy).toHaveBeenCalled();
  });
});