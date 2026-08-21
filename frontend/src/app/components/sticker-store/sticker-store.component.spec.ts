import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, Component, input } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StickerStoreComponent } from './sticker-store.component';
import { EconomyStore, StickerPack } from '../../services/economy.store';
import { AuthService } from '../../services/auth.service';

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
}

@Component({ selector: 'app-gradient-button', template: '<button><ng-content /></button>' })
class MockGradientButtonComponent {}

@Component({ selector: 'app-pill', template: '<span><ng-content /></span>' })
class MockPillComponent {
  readonly colour = input<string>('primary');
  readonly size = input<string>('md');
}

@Component({ selector: 'app-empty-state', template: '' })
class MockEmptyStateComponent {
  readonly icon = input<string>('');
  readonly title = input<string>('');
  readonly description = input<string>('');
}

const mockPacks: StickerPack[] = [
  {
    id: 'stk_pack_1',
    name: 'Happy Corgi Pack',
    cost_coins: 50,
    owned: false,
    is_animated: false,
    sticker_urls: ['assets/stickers/happy.png'],
  },
  {
    id: 'stk_pack_4',
    name: 'Golden Dragons',
    cost_coins: 500,
    owned: true,
    is_animated: true,
    sticker_urls: ['assets/stickers/dragon-fire.webm'],
    animation_url: 'assets/animations/dragon.json',
  },
];

describe('StickerStoreComponent', () => {
  let component: StickerStoreComponent;
  let fixture: ComponentFixture<StickerStoreComponent>;
  let economyStoreMock: {
    stickerPacks: ReturnType<typeof vi.fn>;
    coinsBalance: ReturnType<typeof vi.fn>;
    loadStickerPacks: ReturnType<typeof vi.fn>;
    unlockStickerPack: ReturnType<typeof vi.fn>;
  };
  let authServiceMock: {
    getAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    economyStoreMock = {
      stickerPacks: vi.fn().mockReturnValue(mockPacks),
      coinsBalance: vi.fn().mockReturnValue(200),
      loadStickerPacks: vi.fn().mockResolvedValue(undefined),
      unlockStickerPack: vi.fn().mockResolvedValue(true),
    };
    authServiceMock = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: EconomyStore, useValue: economyStoreMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    })
      .overrideComponent(StickerStoreComponent, {
        set: {
          imports: [
            MockTranslatePipe,
            MockCardComponent,
            MockGradientButtonComponent,
            MockPillComponent,
            MockEmptyStateComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StickerStoreComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const coinDisplay = fixture.nativeElement.querySelector('app-pill');
    if (coinDisplay) {
      const html = coinDisplay.outerHTML;
      expect(html).not.toMatch(/\bpl-\d/);
      expect(html).not.toMatch(/\bpr-\d/);
      expect(html).not.toMatch(/\bml-\d/);
      expect(html).not.toMatch(/\bmr-\d/);
    }
    // Verify no physical direction classes exist in the entire component
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should load sticker packs on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(economyStoreMock.loadStickerPacks).toHaveBeenCalledTimes(1);
  });

  it('should render the coin balance display', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('200');
  });

  it('should call unlockStickerPack when purchase is triggered', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pack = mockPacks[0];
    await component.purchasePack(pack);

    expect(economyStoreMock.unlockStickerPack).toHaveBeenCalledWith('stk_pack_1');
  });

  it('should not call unlockStickerPack for owned packs', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const ownedPack = mockPacks[1];
    await component.purchasePack(ownedPack);

    expect(economyStoreMock.unlockStickerPack).not.toHaveBeenCalled();
  });

  it('should filter packs by category', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectedCategory.set('value');
    fixture.detectChanges();

    const filtered = component.filteredPacks();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('stk_pack_1');
  });
});
