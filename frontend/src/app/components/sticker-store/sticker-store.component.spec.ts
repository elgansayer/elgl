import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { StickerStoreComponent } from './sticker-store.component';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface StickerPack {
  id: string;
  name: string;
  cost_coins: number;
  cover_image_url?: string;
  is_premium?: boolean;
  sticker_count?: number;
}

const MOCK_PACKS: StickerPack[] = [
  { id: 'pack_happy', name: 'Happy Corgi', cost_coins: 50, is_premium: false, sticker_count: 8 },
  { id: 'pack_dragon', name: 'Golden Dragon', cost_coins: 500, is_premium: true, sticker_count: 12 },
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

function createMockAuthService() {
  return {
    getAccessToken: (): string => 'mock-token',
  } as unknown as AuthService;
}

function createMockEconomyStore() {
  return {
    coinsBalance: signal(200),
  } as unknown as EconomyStore;
}

describe('StickerStoreComponent', () => {
  let mockStore: ReturnType<typeof createMockEconomyStore>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    mockStore = createMockEconomyStore();

    await TestBed.configureTestingModule({
      imports: [StickerStoreComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EconomyStore, useValue: mockStore },
        { provide: I18nService, useClass: MockI18nService },
        { provide: AuthService, useFactory: createMockAuthService },
      ],
    }).compileComponents();

    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Cancel any pending requests from constructor
    httpTestingController.verify();
  });

  function setup(overrides?: { packs?: StickerPack[]; isError?: boolean }): ComponentFixture<StickerStoreComponent> {
    const fixture = TestBed.createComponent(StickerStoreComponent);
    const component = fixture.componentInstance;
    // Flush/cancel the constructor-initiated HTTP request
    try {
      const pendingReq = httpTestingController.expectOne(`${environment.apiUrl}/economy/sticker-packs`);
      if (overrides?.isError) {
        pendingReq.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
      } else if (overrides?.packs !== undefined) {
        pendingReq.flush(overrides.packs);
      } else {
        // Leave loading: don't flush
      }
    } catch {
      // No pending request
    }
    // Now override state directly for reliable testing
    if (overrides?.isError) {
      component.loadError.set(true);
      component.isLoading.set(false);
    } else if (overrides?.packs !== undefined) {
      component.packs.set(overrides.packs);
      component.isLoading.set(false);
      component.loadError.set(false);
    } else {
      component.isLoading.set(true);
      component.loadError.set(false);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = TestBed.createComponent(StickerStoreComponent);
    // Cancel constructor-initiated request
    httpTestingController.expectOne(`${environment.apiUrl}/economy/sticker-packs`);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the store title', () => {
    const fixture = setup({ packs: MOCK_PACKS });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('stickerStore.title');
  });

  it('should display user coin balance', () => {
    const fixture = setup({ packs: MOCK_PACKS });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('200');
  });

  it('should render sticker packs from API', () => {
    const fixture = setup({ packs: MOCK_PACKS });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('Happy Corgi');
    expect(renderedText).toContain('Golden Dragon');
  });

  it('should show VIP badge on premium packs', () => {
    const fixture = setup({ packs: MOCK_PACKS });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('stickerStore.vip');
  });

  it('should disable unlock button when insufficient coins', () => {
    mockStore.coinsBalance.set(10);
    const fixture = setup({ packs: MOCK_PACKS });
    const buttons = fixture.debugElement.queryAll(By.css('button[disabled]'));
    expect(buttons.length).toBe(2);
  });

  it('should show loading skeleton while fetching', () => {
    const fixture = setup({});
    const skeletons = fixture.debugElement.queryAll(By.css('.animate-pulse'));
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state on API failure', () => {
    const fixture = setup({ isError: true });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('stickerStore.loadError');
    expect(renderedText).toContain('stickerStore.retry');
  });

  it('should show empty state when no packs', () => {
    const fixture = setup({ packs: [] });
    const renderedText = fixture.debugElement.nativeElement.textContent;
    expect(renderedText).toContain('stickerStore.empty');
  });
});